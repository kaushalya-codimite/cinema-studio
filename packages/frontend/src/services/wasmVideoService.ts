import { VideoClip, Effect } from '../stores/videoProjectStore';
import { videoService } from './videoService';

export interface WasmExportOptions {
  format: 'webm' | 'mp4';
  fps: number;
  width: number;
  height: number;
  quality?: number; // 1-100
  bitrate?: number; // bits per second
  startTime?: number;
  endTime?: number;
}

export interface WasmExportProgress {
  progress: number; // 0-1
  frameIndex: number;
  totalFrames: number;
  processingTimeMs: number;
  effectsApplied: number;
}

/**
 * Unified WASM-based video processing service
 * Handles both preview and export with identical processing
 */
export class WasmVideoService {
  private wasmModule: any = null;
  private effectsEnginePtr: number = 0;
  private exportJobPtr: number = 0;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private framesProcessed: number = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  async initialize(): Promise<void> {
    // Reuse the existing video service WASM module
    await videoService.initialize();
    this.wasmModule = (videoService as any).wasmModule;

    if (!this.wasmModule) {
      throw new Error('WASM module not available');
    }

    // Create effects engine
    this.effectsEnginePtr = this.wasmModule.ccall('js_effects_engine_create', 'number', [], []);
    if (this.effectsEnginePtr === 0) {
      throw new Error('Failed to create effects engine');
    }

    console.log('✅ WasmVideoService initialized with effects engine:', this.effectsEnginePtr);
  }

  /**
   * Apply effects configuration to the WASM effects engine
   */
  configureEffects(effects: Effect[]): void {
    if (this.effectsEnginePtr === 0) {
      console.warn('Effects engine not initialized');
      return;
    }

    // Clear existing effects
    this.wasmModule.ccall('js_effect_chain_clear', 'void', ['number'], [this.effectsEnginePtr]);

    // Add each effect to the chain
    for (const effect of effects) {
      if (!effect.enabled) continue;

      try {
        switch (effect.type) {
          case 'color_correction':
          case 'colorCorrection':
            this.wasmModule.ccall('js_effect_chain_add_color_correction', 'number',
              ['number', 'number', 'number', 'number', 'number'],
              [this.effectsEnginePtr, effect.brightness || 0, effect.contrast || 0,
               effect.saturation || 0, effect.hue || 0]);
            break;

          case 'blur':
            this.wasmModule.ccall('js_effect_chain_add_blur', 'number',
              ['number', 'number', 'number'],
              [this.effectsEnginePtr, effect.intensity * 20, 1]); // gaussian blur
            break;

          case 'transform':
            this.wasmModule.ccall('js_effect_chain_add_transform', 'number',
              ['number', 'number', 'number', 'number', 'number'],
              [this.effectsEnginePtr, effect.scale || 100, effect.rotation || 0,
               effect.flipHorizontal ? 1 : 0, effect.flipVertical ? 1 : 0]);
            break;

          case 'sepia':
          case 'blackAndWhite':
          case 'vintage':
          case 'vignette':
          case 'sharpen':
          case 'edgeDetection':
            // Map string effect types to filter enum values
            const filterTypeMap: { [key: string]: number } = {
              'sepia': 6,
              'blackAndWhite': 7,
              'vintage': 8,
              'vignette': 9,
              'sharpen': 2,
              'edgeDetection': 3
            };

            const filterType = filterTypeMap[effect.type] || 0;
            this.wasmModule.ccall('js_effect_chain_add_filter', 'number',
              ['number', 'number', 'number'],
              [this.effectsEnginePtr, filterType, effect.intensity || 1.0]);
            break;

          default:
            console.warn(`Unknown effect type: ${effect.type}`);
            break;
        }
      } catch (error) {
        console.error(`Failed to add effect ${effect.type}:`, error);
      }
    }

    const effectCount = this.wasmModule.ccall('js_effect_chain_get_count', 'number',
      ['number'], [this.effectsEnginePtr]);
    console.log(`🎨 Applied ${effectCount} effects to WASM engine`);
  }

  /**
   * Process a single frame with all configured effects
   */
  processFrame(frameData: ImageData, timestamp: number): ImageData {
    if (this.effectsEnginePtr === 0) {
      return frameData; // Return unprocessed if no effects engine
    }

    try {
      // Allocate WASM memory for frame data
      const frameSize = frameData.width * frameData.height * 4; // RGBA
      const wasmFramePtr = this.wasmModule.ccall('js_malloc', 'number', ['number'], [frameSize]);

      if (wasmFramePtr === 0) {
        console.error('Failed to allocate WASM memory for frame');
        return frameData;
      }

      // Copy frame data to WASM memory
      this.wasmModule.HEAPU8.set(frameData.data, wasmFramePtr);

      // Process frame with effects
      const success = this.wasmModule.ccall('js_effects_process_frame', 'number',
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [this.effectsEnginePtr, wasmFramePtr, frameData.width, frameData.height, 1, timestamp]);

      if (success) {
        // Copy processed data back to ImageData
        const processedData = new Uint8ClampedArray(
          this.wasmModule.HEAPU8.subarray(wasmFramePtr, wasmFramePtr + frameSize)
        );
        frameData.data.set(processedData);
      }

      // Free WASM memory
      this.wasmModule.ccall('js_free', 'void', ['number'], [wasmFramePtr]);

      return frameData;
    } catch (error) {
      console.error('Error processing frame:', error);
      return frameData;
    }
  }

  /**
   * Extract and process frames from video clips with effects
   */
  async extractProcessedFrames(
    clips: VideoClip[],
    effects: Effect[],
    options: WasmExportOptions,
    onProgress?: (progress: WasmExportProgress) => void
  ): Promise<ImageData[]> {
    console.log(`🎬 Extracting processed frames: ${options.width}x${options.height} @ ${options.fps}fps`);

    // Configure effects
    this.configureEffects(effects);

    // Set canvas dimensions
    this.canvas.width = options.width;
    this.canvas.height = options.height;

    // Calculate timing
    const totalDuration = this.calculateTotalDuration(clips);
    const startTime = options.startTime || 0;
    const endTime = options.endTime || totalDuration;
    const duration = endTime - startTime;
    const totalFrames = Math.ceil(duration * options.fps);
    const frameDuration = 1 / options.fps;

    const frames: ImageData[] = [];
    const startProcessTime = performance.now();

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const currentTime = startTime + (frameIndex * frameDuration);

      // Clear canvas
      this.ctx.clearRect(0, 0, options.width, options.height);
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, options.width, options.height);

      // Render clips at current time
      await this.renderClipsAtTime(clips, currentTime, options);

      // Extract frame data (effects already applied in renderClipsAtTime)
      const frameData = this.ctx.getImageData(0, 0, options.width, options.height);

      frames.push(frameData);
      this.framesProcessed++;

      // Report progress
      const progress = (frameIndex + 1) / totalFrames;
      const processingTime = performance.now() - startProcessTime;
      const effectCount = this.wasmModule.ccall('js_effect_chain_get_count', 'number',
        ['number'], [this.effectsEnginePtr]);

      onProgress?.({
        progress,
        frameIndex: frameIndex + 1,
        totalFrames,
        processingTimeMs: processingTime,
        effectsApplied: effectCount
      });
    }

    console.log(`✅ Extracted ${frames.length} processed frames`);
    return frames;
  }

  /**
   * Export video using WASM encoder with effects
   */
  async exportVideo(
    clips: VideoClip[],
    effects: Effect[],
    options: WasmExportOptions,
    onProgress?: (progress: WasmExportProgress) => void
  ): Promise<Uint8Array> {
    console.log(`🚀 Starting WASM video export: ${options.format}`);

    // Reset frame counter for this export
    this.framesProcessed = 0;

    // WASM video encoder is not fully implemented yet
    // Use frame extraction and canvas export directly
    console.log('⚠️ WASM video encoder not implemented, using frame extraction');

    // Extract processed frames
    const processedFrames = await this.extractProcessedFrames(
      clips, effects, options, onProgress
    );

    if (processedFrames.length === 0) {
      throw new Error('No frames were processed for export');
    }

    // Use canvas export service as fallback
    const { canvasExportService } = await import('./canvasExportService');
    const canvasOptions = {
      format: options.format,
      fps: options.fps,
      width: options.width,
      height: options.height,
      quality: (options.quality || 80) / 100 // Convert to 0-1 range
    };

    console.log(`🎬 Using canvas fallback export: ${processedFrames.length} processed frames`);
    const videoData = await canvasExportService.exportVideo(
      processedFrames,
      canvasOptions,
      (progress) => {
        // Progress is already reported during frame extraction
      }
    );

    console.log('✅ WASM unified export completed with canvas fallback');
    return videoData;
  }

  private calculateTotalDuration(clips: VideoClip[]): number {
    return clips.reduce((total, clip) => {
      return Math.max(total, clip.startTime + clip.duration);
    }, 0);
  }

  private async renderClipsAtTime(clips: VideoClip[], currentTime: number, options: any): Promise<void> {
    // Check for transitions first (same logic as preview)
    const transitionResult = await this.handleTransitions(clips, currentTime, options);
    if (transitionResult) {
      // Transition was applied, put the result on canvas
      const imageData = new ImageData(new Uint8ClampedArray(transitionResult.frameData), transitionResult.width, transitionResult.height);
      this.ctx.putImageData(imageData, 0, 0);
      return;
    }

    // No transition, render normal clip
    for (const clip of clips) {
      if (clip.videoInfo?.videoElement) {
        const clipStartTime = clip.startTime;
        const clipEndTime = clip.startTime + clip.duration;

        if (currentTime >= clipStartTime && currentTime < clipEndTime) {
          const localTime = currentTime - clipStartTime + (clip.trimStart || 0);

          try {
            clip.videoInfo.videoElement.currentTime = localTime;
            await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for seeking

            // Draw clip to fill entire canvas (no positioning for now)
            this.ctx.drawImage(
              clip.videoInfo.videoElement,
              0, // x position
              0, // y position
              options.width, // destination width
              options.height // destination height
            );

            // Apply effects using the same pipeline as preview
            await this.applyClipEffects(clip, options);
          } catch (error) {
            console.warn(`Failed to render clip at time ${currentTime}:`, error);
          }
        }
      }
    }
  }

  /**
   * Handle transitions during export (same logic as preview)
   */
  private async handleTransitions(clips: VideoClip[], time: number, options: any): Promise<any> {
    // Find clips that have transitions and check if we're in a transition zone
    for (let i = 0; i < clips.length; i++) {
      const currentClip = clips[i];

      if (!currentClip.transition || !currentClip.transition.enabled) continue;

      const transitionStart = currentClip.endTime - currentClip.transition.duration;
      const transitionEnd = currentClip.endTime;

      // Check if current time is within this clip's transition zone
      if (time >= transitionStart && time <= transitionEnd) {
        // Find the next clip (the one that starts at or after this clip ends)
        const nextClip = clips
          .filter(clip => clip.id !== currentClip.id) // Don't transition to self
          .sort((a, b) => a.startTime - b.startTime) // Sort by start time
          .find(clip => clip.startTime >= currentClip.endTime - currentClip.transition.duration);

        if (nextClip) {
          console.log(`🎬 Export transition detected: ${currentClip.transition.type} at time ${time.toFixed(2)}s`);

          // Calculate transition progress (0.0 to 1.0)
          const progress = (time - transitionStart) / currentClip.transition.duration;

          try {
            // Extract frames from both clips (same as preview)
            const currentVideoTime = time - currentClip.startTime + (currentClip.trimStart || 0);
            const nextVideoTime = time - nextClip.startTime + (nextClip.trimStart || 0);

            const frame1 = await this.extractFrameFromClip(currentClip, currentVideoTime, options);
            const frame2 = await this.extractFrameFromClip(nextClip, nextVideoTime, options);

            if (frame1 && frame2) {
              // Apply effects to both frames first (same as preview)
              const processedFrame1 = await this.applyEffectsToFrame(frame1, currentClip, options);
              const processedFrame2 = await this.applyEffectsToFrame(frame2, nextClip, options);

              // Apply transitions using WASM with processed frames
              const result = await this.applyTransitionWASM(processedFrame1, processedFrame2, currentClip.transition, progress);
              return result;
            }
          } catch (error) {
            console.error('❌ Export transition failed:', error);
          }
        }
      }
    }

    return null; // No transition found
  }

  /**
   * Extract a frame from a clip at a specific time (for transitions)
   */
  private async extractFrameFromClip(clip: VideoClip, videoTime: number, options: any): Promise<any> {
    if (!clip.videoInfo?.videoElement) return null;

    try {
      clip.videoInfo.videoElement.currentTime = videoTime;
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for seeking

      // Create a temporary canvas to extract the frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = options.width;
      tempCanvas.height = options.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;

      // Draw the clip frame
      tempCtx.drawImage(clip.videoInfo.videoElement, 0, 0, options.width, options.height);

      // Extract frame data
      const imageData = tempCtx.getImageData(0, 0, options.width, options.height);

      return {
        imageData,
        width: options.width,
        height: options.height
      };
    } catch (error) {
      console.error('Failed to extract frame from clip:', error);
      return null;
    }
  }

  /**
   * Apply effects to a frame (for transitions)
   */
  private async applyEffectsToFrame(frame: any, clip: VideoClip, options: any): Promise<any> {
    if (!frame || !clip.effects || clip.effects.length === 0) {
      return frame; // Return original if no effects
    }

    // Apply ALL effects (same as main export logic)
    let rgbaData = this.convertImageDataToRGBA(frame.imageData);

    // Apply all enabled effects in order (same as main export)
    for (const effect of clip.effects) {
      if (!effect.enabled) continue;

      switch (effect.type) {
        case 'color_correction':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            await videoService.applyColorCorrection(rgbaData, options.width, options.height, effect.parameters as any);
          } catch (error) {
            console.error('❌ Color correction failed in export transition:', error);
          }
          break;

        case 'transform':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyTransform(rgbaData, options.width, options.height, effect.parameters as any);
          } catch (error) {
            console.error('❌ Transform failed in export transition:', error);
          }
          break;

        case 'blur':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyBlurFilter(rgbaData, options.width, options.height, effect.parameters.radius || 1);
          } catch (error) {
            console.error('❌ Blur failed in export transition:', error);
          }
          break;

        case 'sharpen':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applySharpenFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Sharpen failed in export transition:', error);
          }
          break;

        case 'noise_reduction':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyNoiseReduction(rgbaData, options.width, options.height, effect.parameters.strength || 0.5);
          } catch (error) {
            console.error('❌ Noise reduction failed in export transition:', error);
          }
          break;

        case 'sepia':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applySepiaFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Sepia failed in export transition:', error);
          }
          break;

        case 'black_and_white':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyBlackAndWhiteFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Black and white failed in export transition:', error);
          }
          break;

        case 'vintage':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyVintageFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Vintage failed in export transition:', error);
          }
          break;

        case 'vignette':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyVignetteFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Vignette failed in export transition:', error);
          }
          break;

        case 'edge_detection':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyEdgeDetectionFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Edge detection failed in export transition:', error);
          }
          break;

        default:
          console.warn(`Unknown effect type in export transition: ${effect.type}`);
          break;
      }
    }

    // Return frame with processed data
    return {
      imageData: new ImageData(new Uint8ClampedArray(rgbaData), options.width, options.height),
      width: options.width,
      height: options.height
    };
  }

  /**
   * Apply transition effects using WASM (same as preview)
   */
  private async applyTransitionWASM(frame1: any, frame2: any, transition: any, progress: number): Promise<any> {
    try {
      const { videoService } = await import('./videoService');
      await videoService.initialize();

      const width = frame1.imageData.width;
      const height = frame1.imageData.height;

      const frame1Data = this.convertImageDataToRGBA(frame1.imageData);
      const frame2Data = this.convertImageDataToRGBA(frame2.imageData);
      const outputData = new Uint8Array(frame1Data.length);

      // Apply the appropriate transition
      switch (transition.type) {
        case 'fade':
          videoService.applyFadeTransition(frame1Data, frame2Data, outputData, width, height, progress);
          break;
        case 'dissolve':
          videoService.applyDissolveTransition(frame1Data, frame2Data, outputData, width, height, progress);
          break;
        case 'wipe_left':
          videoService.applyWipeTransition(frame1Data, frame2Data, outputData, width, height, progress, 'left');
          break;
        case 'wipe_right':
          videoService.applyWipeTransition(frame1Data, frame2Data, outputData, width, height, progress, 'right');
          break;
        case 'wipe_up':
          videoService.applyWipeTransition(frame1Data, frame2Data, outputData, width, height, progress, 'up');
          break;
        case 'wipe_down':
          videoService.applyWipeTransition(frame1Data, frame2Data, outputData, width, height, progress, 'down');
          break;
        default:
          console.warn(`❓ Unknown transition type in export: ${transition.type}`);
          // Fallback to simple copy
          outputData.set(frame1Data);
      }

      return { frameData: outputData, width, height };
    } catch (error) {
      console.error('❌ WASM transition failed in export:', error);
      return null;
    }
  }

  /**
   * Apply clip effects using the same methods as VideoPreview
   */
  private async applyClipEffects(clip: VideoClip, options: any): Promise<void> {
    if (!clip.effects || clip.effects.length === 0) return;

    // Get current frame data from canvas
    const frameData = this.ctx.getImageData(0, 0, options.width, options.height);
    let rgbaData = this.convertImageDataToRGBA(frameData);

    // Apply all enabled effects in order (same as preview)
    for (const effect of clip.effects) {
      if (!effect.enabled) continue;

      switch (effect.type) {
        case 'color_correction':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            await videoService.applyColorCorrection(rgbaData, options.width, options.height, effect.parameters as any);
          } catch (error) {
            console.error('❌ Color correction failed in export:', error);
          }
          break;

        case 'transform':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyTransform(rgbaData, options.width, options.height, effect.parameters as any);
          } catch (error) {
            console.error('❌ Transform failed in export:', error);
          }
          break;

        case 'blur':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyBlurFilter(rgbaData, options.width, options.height, effect.parameters.radius || 1);
          } catch (error) {
            console.error('❌ Blur failed in export:', error);
          }
          break;

        case 'sharpen':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applySharpenFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Sharpen failed in export:', error);
          }
          break;

        case 'noise_reduction':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyNoiseReduction(rgbaData, options.width, options.height, effect.parameters.strength || 0.5);
          } catch (error) {
            console.error('❌ Noise reduction failed in export:', error);
          }
          break;

        case 'sepia':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applySepiaFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Sepia failed in export:', error);
          }
          break;

        case 'black_and_white':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyBlackAndWhiteFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Black and white failed in export:', error);
          }
          break;

        case 'vintage':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyVintageFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Vintage failed in export:', error);
          }
          break;

        case 'vignette':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyVignetteFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Vignette failed in export:', error);
          }
          break;

        case 'edge_detection':
          try {
            const { videoService } = await import('./videoService');
            await videoService.initialize();
            videoService.applyEdgeDetectionFilter(rgbaData, options.width, options.height, effect.parameters.intensity || 0.5);
          } catch (error) {
            console.error('❌ Edge detection failed in export:', error);
          }
          break;

        default:
          console.warn(`Unknown effect type in export: ${effect.type}`);
          break;
      }
    }

    // Convert back to ImageData and draw to canvas
    const processedImageData = this.convertRGBAToImageData(rgbaData, options.width, options.height);
    this.ctx.putImageData(processedImageData, 0, 0);
  }

  private convertImageDataToRGBA(imageData: ImageData): Uint8Array {
    // ImageData is already RGBA format
    return new Uint8Array(imageData.data);
  }

  private convertRGBAToImageData(rgbaData: Uint8Array, width: number, height: number): ImageData {
    const clampedArray = new Uint8ClampedArray(rgbaData);
    return new ImageData(clampedArray, width, height);
  }

  /**
   * Get processing performance statistics
   */
  getPerformanceStats(): { framesProcessed: number; avgProcessingTime: number } {
    // Return the actual frame count we processed during export
    return {
      framesProcessed: this.framesProcessed,
      avgProcessingTime: 0 // We don't track avg processing time anymore
    };
  }

  /**
   * Clean up WASM resources
   */
  destroy(): void {
    if (this.exportJobPtr !== 0) {
      this.wasmModule.ccall('js_export_job_destroy', 'void', ['number'], [this.exportJobPtr]);
      this.exportJobPtr = 0;
    }

    if (this.effectsEnginePtr !== 0) {
      this.wasmModule.ccall('js_effects_engine_destroy', 'void', ['number'], [this.effectsEnginePtr]);
      this.effectsEnginePtr = 0;
    }
  }
}

// Singleton instance
export const wasmVideoService = new WasmVideoService();