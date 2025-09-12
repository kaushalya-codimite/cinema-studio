import { VideoClip } from '../stores/videoProjectStore';

export interface FrameExtractionOptions {
  width: number;
  height: number;
  fps: number;
  startTime?: number;
  endTime?: number;
}

export class FrameExtractionService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  async extractFramesFromClips(
    clips: VideoClip[],
    options: FrameExtractionOptions,
    onProgress?: (progress: number, frameIndex: number, totalFrames: number) => void
  ): Promise<ImageData[]> {
    console.log(`🎬 Extracting frames: ${options.width}x${options.height} @ ${options.fps}fps`);

    // Set canvas dimensions
    this.canvas.width = options.width;
    this.canvas.height = options.height;

    // Ensure all video elements are properly loaded before starting
    console.log(`📼 Ensuring all ${clips.length} video clips are ready...`);
    for (const clip of clips) {
      if (clip.videoInfo && clip.videoInfo.videoElement) {
        await this.ensureVideoReady(clip.videoInfo.videoElement);
      }
    }
    console.log(`✅ All video clips are ready for frame extraction`);

    // Calculate total duration and frame count
    const totalDuration = this.calculateTotalDuration(clips);
    const startTime = options.startTime || 0;
    const endTime = options.endTime || totalDuration;
    const duration = endTime - startTime;
    
    const totalFrames = Math.ceil(duration * options.fps);
    const frameDuration = 1 / options.fps; // Duration per frame in seconds

    console.log(`📊 Total duration: ${duration}s, Total frames: ${totalFrames}`);

    const frames: ImageData[] = [];

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const currentTime = startTime + (frameIndex * frameDuration);
      
      // Clear canvas
      this.ctx.clearRect(0, 0, options.width, options.height);
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, options.width, options.height);

      // Render all clips that should be visible at this time
      await this.renderClipsAtTime(clips, currentTime, options);

      // Extract frame data
      const frameData = this.ctx.getImageData(0, 0, options.width, options.height);
      
      // Sample center pixel to verify frame uniqueness
      const centerX = Math.floor(options.width / 2);
      const centerY = Math.floor(options.height / 2);
      const centerIndex = (centerY * options.width + centerX) * 4;
      const r = frameData.data[centerIndex];
      const g = frameData.data[centerIndex + 1];
      const b = frameData.data[centerIndex + 2];
      
      frames.push(frameData);

      // Report progress
      const progress = ((frameIndex + 1) / totalFrames) * 100;
      onProgress?.(progress, frameIndex + 1, totalFrames);

      if (frameIndex % 10 === 0 || frameIndex === totalFrames - 1) {
        console.log(`📸 Extracted frame ${frameIndex + 1}/${totalFrames} (${progress.toFixed(1)}%) at time ${currentTime.toFixed(3)}s - Center pixel RGB(${r},${g},${b})`);
      }
    }

    console.log(`✅ Frame extraction completed: ${frames.length} frames`);
    return frames;
  }

  private async renderClipsAtTime(clips: VideoClip[], currentTime: number, options: FrameExtractionOptions): Promise<void> {
    // Sort clips by track index - lower numbers render first
    const sortedClips = [...clips].sort((a, b) => a.trackIndex - b.trackIndex);

    // Only log every 30 frames to reduce console spam
    const shouldLog = Math.floor(currentTime * options.fps) % 30 === 0;
    
    if (shouldLog) {
      console.log(`🎬 Rendering clips at currentTime=${currentTime.toFixed(3)}s:`);
    }
    
    for (const clip of sortedClips) {
      if (shouldLog) {
        console.log(`  📹 Clip "${clip.name}": startTime=${clip.startTime.toFixed(3)}s, endTime=${clip.endTime.toFixed(3)}s, duration=${clip.duration.toFixed(3)}s`);
      }
      
      // Check if clip should be visible at current time
      if (currentTime < clip.startTime || currentTime >= clip.endTime) {
        if (shouldLog) {
          console.log(`  ⏭️ Skipping clip "${clip.name}" - not visible at time ${currentTime.toFixed(3)}s`);
        }
        continue;
      }

      // Calculate relative time within the clip
      const relativeTime = currentTime - clip.startTime;
      if (shouldLog) {
        console.log(`  ✅ Rendering clip "${clip.name}" at relativeTime=${relativeTime.toFixed(3)}s`);
      }
      await this.renderClipFrame(clip, relativeTime, options);
    }
  }

  private async renderClipFrame(clip: VideoClip, relativeTime: number, options: FrameExtractionOptions): Promise<void> {
    try {
      // All clips in this system are video clips with videoInfo
      if (clip.videoInfo && clip.videoInfo.videoElement) {
        await this.renderVideoFrame(clip, relativeTime, options);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to render frame for clip ${clip.id}:`, error);
    }
  }

  private async renderVideoFrame(clip: VideoClip, relativeTime: number, options: FrameExtractionOptions): Promise<void> {
    if (!clip.videoInfo || !clip.videoInfo.videoElement) return;

    const videoElement = clip.videoInfo.videoElement;

    // Calculate the absolute video time within the clip's source video
    const videoTime = relativeTime;
    const seekTime = Math.max(0, Math.min(videoTime, videoElement.duration));
    
    console.log(`🎬 Seeking clip ${clip.name} to time ${seekTime.toFixed(3)}s (relative: ${relativeTime.toFixed(3)}s, duration: ${videoElement.duration.toFixed(3)}s)`);
    
    // Force seek by setting currentTime and waiting properly
    const oldTime = videoElement.currentTime;
    videoElement.currentTime = seekTime;
    
    // Force the video to load the frame by ensuring it's paused
    videoElement.pause();
    
    // Wait for the seek to complete
    await this.waitForVideoSeek(videoElement, seekTime);
    
    console.log(`📺 Video seeked from ${oldTime.toFixed(3)}s to ${videoElement.currentTime.toFixed(3)}s (target: ${seekTime.toFixed(3)}s)`);

    // Ensure video is ready to render
    if (videoElement.readyState < 2) {
      console.warn(`⚠️ Video not ready (readyState: ${videoElement.readyState})`);
      return;
    }

    // Calculate rendering dimensions and position
    const renderInfo = this.calculateRenderInfo(clip, options);

    // Draw video frame to canvas
    this.ctx.save();
    this.ctx.globalAlpha = 1;
    
    this.ctx.drawImage(
      videoElement,
      renderInfo.sx, renderInfo.sy, renderInfo.sWidth, renderInfo.sHeight,
      renderInfo.dx, renderInfo.dy, renderInfo.dWidth, renderInfo.dHeight
    );
    
    this.ctx.restore();

    // Sample center pixel immediately after drawing to verify frame content
    const centerX = Math.floor(renderInfo.dx + renderInfo.dWidth / 2);
    const centerY = Math.floor(renderInfo.dy + renderInfo.dHeight / 2);
    const preEffectPixel = this.ctx.getImageData(centerX, centerY, 1, 1);
    const preR = preEffectPixel.data[0], preG = preEffectPixel.data[1], preB = preEffectPixel.data[2];
    
    console.log(`🖼️ Frame drawn at time ${seekTime.toFixed(3)}s - Pre-effect center pixel RGB(${preR},${preG},${preB})`);

    // Apply effects to the rendered frame
    console.log(`🎨 Applying ${clip.effects.length} effects to clip ${clip.name} at time ${seekTime.toFixed(3)}s`);
    await this.applyEffectsToCanvas(clip, renderInfo);
    
    // Sample center pixel after effects
    const postEffectPixel = this.ctx.getImageData(centerX, centerY, 1, 1);
    const postR = postEffectPixel.data[0], postG = postEffectPixel.data[1], postB = postEffectPixel.data[2];
    console.log(`🎭 Post-effect center pixel RGB(${postR},${postG},${postB})`);
    
    if (preR === postR && preG === postG && preB === postB) {
      console.warn(`⚠️ No visual change detected after effects application`);
    }
  }


  private calculateRenderInfo(clip: VideoClip, options: FrameExtractionOptions) {
    // Source dimensions (from video info)
    const sourceWidth = clip.videoInfo.width;
    const sourceHeight = clip.videoInfo.height;

    // For now, just scale to fit the canvas maintaining aspect ratio
    const aspectRatio = sourceWidth / sourceHeight;
    const canvasAspectRatio = options.width / options.height;

    let dWidth: number, dHeight: number;
    
    if (aspectRatio > canvasAspectRatio) {
      // Video is wider than canvas
      dWidth = options.width;
      dHeight = options.width / aspectRatio;
    } else {
      // Video is taller than canvas
      dHeight = options.height;
      dWidth = options.height * aspectRatio;
    }

    // Center the video
    const dx = (options.width - dWidth) / 2;
    const dy = (options.height - dHeight) / 2;

    return {
      sx: 0, sy: 0, sWidth: sourceWidth, sHeight: sourceHeight,
      dx, dy, dWidth, dHeight
    };
  }

  private async waitForVideoSeek(video: HTMLVideoElement, targetTime: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startWaitTime = Date.now();
      const maxWaitTime = 2000; // Increased to 2 seconds
      let attempts = 0;
      const maxAttempts = 5;
      
      console.log(`⏰ Seeking video to ${targetTime.toFixed(3)}s (current: ${video.currentTime.toFixed(3)}s)`);
      
      const attemptSeek = async () => {
        attempts++;
        console.log(`⏰ Seek attempt ${attempts}/${maxAttempts} - setting currentTime to ${targetTime.toFixed(3)}s`);
        
        // Force seek
        video.currentTime = targetTime;
        
        // Wait a bit for the seek to process
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const currentDiff = Math.abs(video.currentTime - targetTime);
        const elapsed = Date.now() - startWaitTime;
        
        console.log(`⏰ After seek attempt ${attempts}: target=${targetTime.toFixed(3)}s, current=${video.currentTime.toFixed(3)}s, diff=${currentDiff.toFixed(3)}s, elapsed=${elapsed}ms`);
        
        // Success condition: within 100ms or very close
        if (currentDiff < 0.1 || elapsed > maxWaitTime) {
          console.log(`⏰ Seek ${currentDiff < 0.1 ? 'successful' : 'timed out'} after ${elapsed}ms and ${attempts} attempts`);
          resolve();
          return;
        }
        
        // If we still have attempts left and time, try again
        if (attempts < maxAttempts && elapsed < maxWaitTime) {
          console.log(`⏰ Seek not precise enough (diff: ${currentDiff.toFixed(3)}s), retrying...`);
          setTimeout(attemptSeek, 100);
        } else {
          console.log(`⏰ Max attempts (${maxAttempts}) or time (${maxWaitTime}ms) reached, accepting current position`);
          resolve();
        }
      };
      
      // Video should already be ready at this point, so start seeking immediately
      if (video.readyState < 2) {
        console.warn(`⚠️ Video still not ready (readyState: ${video.readyState}) despite pre-loading`);
      }
      
      attemptSeek();
    });
  }

  private async applyEffectsToCanvas(clip: VideoClip, renderInfo: any): Promise<void> {
    if (!clip.effects || clip.effects.length === 0) {
      console.log(`⚪ No effects to apply for clip ${clip.name}`);
      return;
    }

    console.log(`🎭 Processing ${clip.effects.length} effects for clip ${clip.name}:`);
    clip.effects.forEach((effect, i) => {
      console.log(`  ${i+1}. ${effect.type} - enabled: ${effect.enabled} - params:`, effect.parameters);
    });

    // Get current frame data from canvas
    const imageData = this.ctx.getImageData(
      Math.floor(renderInfo.dx), 
      Math.floor(renderInfo.dy), 
      Math.floor(renderInfo.dWidth), 
      Math.floor(renderInfo.dHeight)
    );

    console.log(`🖼️ Extracted image data: ${imageData.width}x${imageData.height} pixels`);

    // Apply each enabled effect
    let effectsApplied = 0;
    for (const effect of clip.effects) {
      if (!effect.enabled) {
        console.log(`⏩ Skipping disabled effect: ${effect.type}`);
        continue;
      }

      console.log(`🎨 Applying effect: ${effect.type} with params:`, effect.parameters);

      switch (effect.type) {
        case 'color_correction':
          this.applyColorCorrection(imageData, effect.parameters);
          effectsApplied++;
          break;
        case 'blur':
          this.applyBlur(imageData, effect.parameters.radius || 1);
          effectsApplied++;
          break;
        case 'sharpen':
          this.applySharpen(imageData, effect.parameters.intensity || 1);
          effectsApplied++;
          break;
        case 'noise_reduction':
          this.applyNoiseReduction(imageData, effect.parameters.strength || 0.5);
          effectsApplied++;
          break;
        default:
          console.warn(`❌ Unknown effect type: ${effect.type}`);
      }
    }

    console.log(`✅ Applied ${effectsApplied} effects to clip ${clip.name}`);

    // Put the modified image data back to canvas
    this.ctx.putImageData(
      imageData, 
      Math.floor(renderInfo.dx), 
      Math.floor(renderInfo.dy)
    );
  }

  private applyColorCorrection(imageData: ImageData, params: Record<string, number>): void {
    const data = imageData.data;
    
    // MATCH WASM IMPLEMENTATION EXACTLY
    const brightness = params.brightness || 0; // WASM: direct addition in 0-1 range
    const contrast = params.contrast || 0; // WASM: (x - 0.5) * (1 + contrast) + 0.5
    const saturation = params.saturation || 0; // WASM: s *= (1.0 + saturation)
    const hue = params.hue || 0; // WASM: h += hue (degrees)
    const gamma = params.gamma || 1; // WASM: pow(x, 1/gamma)
    const exposure = params.exposure || 0; // WASM: x *= pow(2, exposure)

    console.log(`🌈 WASM-MATCHED Color correction: brightness=${brightness}, contrast=${contrast}, saturation=${saturation}, hue=${hue}, gamma=${gamma}, exposure=${exposure}`);

    // Sample first pixel before correction for debugging
    const beforeR = data[0], beforeG = data[1], beforeB = data[2];
    
    let pixelsProcessed = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Convert to 0-1 range for processing (WASM does this)
      let rf = data[i] / 255.0;
      let gf = data[i + 1] / 255.0;
      let bf = data[i + 2] / 255.0;

      // Apply brightness (WASM: rf += brightness)
      rf += brightness;
      gf += brightness;
      bf += brightness;

      // Apply contrast (WASM: (rf - 0.5) * (1 + contrast) + 0.5)
      rf = (rf - 0.5) * (1.0 + contrast) + 0.5;
      gf = (gf - 0.5) * (1.0 + contrast) + 0.5;
      bf = (bf - 0.5) * (1.0 + contrast) + 0.5;

      // Apply gamma correction (WASM: pow(rf, 1/gamma))
      if (gamma !== 1.0) {
        rf = Math.pow(Math.max(rf, 0.0), 1.0 / gamma);
        gf = Math.pow(Math.max(gf, 0.0), 1.0 / gamma);
        bf = Math.pow(Math.max(bf, 0.0), 1.0 / gamma);
      }

      // Apply exposure (WASM: rf *= pow(2, exposure))
      const exposureMultiplier = Math.pow(2.0, exposure);
      rf *= exposureMultiplier;
      gf *= exposureMultiplier;
      bf *= exposureMultiplier;

      // Apply saturation and hue adjustments using HSV (exactly like WASM)
      if (saturation !== 0.0 || hue !== 0.0) {
        // Convert to uint8 for HSV conversion (like WASM)
        const r255 = this.clamp(rf * 255.0);
        const g255 = this.clamp(gf * 255.0);
        const b255 = this.clamp(bf * 255.0);
        
        const [h, s, v] = this.rgbToHsvWasm(r255, g255, b255);
        
        // Adjust hue (WASM: h += hue)
        let newH = h + hue;
        
        // Adjust saturation (WASM: s *= (1 + saturation))
        let newS = s * (1.0 + saturation);
        newS = Math.max(0.0, Math.min(1.0, newS));
        
        const [newR, newG, newB] = this.hsvToRgbWasm(newH, newS, v);
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
      } else {
        data[i] = this.clamp(rf * 255.0);
        data[i + 1] = this.clamp(gf * 255.0);
        data[i + 2] = this.clamp(bf * 255.0);
      }
      
      pixelsProcessed++;
    }

    // Sample first pixel after correction for debugging
    const afterR = data[0], afterG = data[1], afterB = data[2];
    const changeR = Math.abs(afterR - beforeR);
    const changeG = Math.abs(afterG - beforeG); 
    const changeB = Math.abs(afterB - beforeB);
    const totalChange = changeR + changeG + changeB;
    
    console.log(`🌈 WASM-MATCHED First pixel: RGB(${beforeR},${beforeG},${beforeB}) → RGB(${afterR},${afterG},${afterB})`);
    console.log(`🌈 WASM-MATCHED Pixel change magnitude: ΔR=${changeR}, ΔG=${changeG}, ΔB=${changeB}, Total=${totalChange}`);
    console.log(`🌈 WASM-MATCHED Processed ${pixelsProcessed} pixels with ${totalChange > 5 ? 'SIGNIFICANT' : 'minimal'} changes`);
  }

  // Clamp value like WASM
  private clamp(value: number): number {
    if (value < 0.0) return 0;
    if (value > 255.0) return 255;
    return Math.round(value);
  }

  // WASM-MATCHED RGB to HSV conversion (exactly like color_correction.c)
  private rgbToHsvWasm(r: number, g: number, b: number): [number, number, number] {
    const rf = r / 255.0;
    const gf = g / 255.0;
    const bf = b / 255.0;
    
    const max_val = Math.max(rf, Math.max(gf, bf));
    const min_val = Math.min(rf, Math.min(gf, bf));
    const delta = max_val - min_val;
    
    const v = max_val;
    
    let s: number;
    if (max_val === 0.0) {
      s = 0.0;
    } else {
      s = delta / max_val;
    }
    
    let h: number;
    if (delta === 0.0) {
      h = 0.0;
    } else if (max_val === rf) {
      h = 60.0 * ((gf - bf) / delta);
      if (h < 0.0) h += 360.0;
    } else if (max_val === gf) {
      h = 60.0 * ((bf - rf) / delta) + 120.0;
    } else {
      h = 60.0 * ((rf - gf) / delta) + 240.0;
    }
    
    return [h, s, v];
  }

  // WASM-MATCHED HSV to RGB conversion (exactly like color_correction.c)
  private hsvToRgbWasm(h: number, s: number, v: number): [number, number, number] {
    if (s === 0.0) {
      const gray = this.clamp(v * 255.0);
      return [gray, gray, gray];
    }
    
    h = h % 360.0;
    if (h < 0.0) h += 360.0;
    
    const hi = Math.floor(h / 60.0);
    const f = (h / 60.0) - hi;
    const p = v * (1.0 - s);
    const q = v * (1.0 - s * f);
    const t = v * (1.0 - s * (1.0 - f));
    
    let r: number, g: number, b: number;
    switch (hi) {
      case 0: r = this.clamp(v * 255.0); g = this.clamp(t * 255.0); b = this.clamp(p * 255.0); break;
      case 1: r = this.clamp(q * 255.0); g = this.clamp(v * 255.0); b = this.clamp(p * 255.0); break;
      case 2: r = this.clamp(p * 255.0); g = this.clamp(v * 255.0); b = this.clamp(t * 255.0); break;
      case 3: r = this.clamp(p * 255.0); g = this.clamp(q * 255.0); b = this.clamp(v * 255.0); break;
      case 4: r = this.clamp(t * 255.0); g = this.clamp(p * 255.0); b = this.clamp(v * 255.0); break;
      default: r = this.clamp(v * 255.0); g = this.clamp(p * 255.0); b = this.clamp(q * 255.0); break;
    }
    
    return [r, g, b];
  }

  // Helper function: RGB to HSV conversion (kept for compatibility)
  private rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff !== 0) {
      if (max === r) h = ((g - b) / diff) % 6;
      else if (max === g) h = (b - r) / diff + 2;
      else h = (r - g) / diff + 4;
    }
    h *= Math.PI / 3; // Convert to radians

    const s = max === 0 ? 0 : diff / max;
    const v = max;

    return [h, s, v];
  }

  // Helper function: HSV to RGB conversion (kept for compatibility)
  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / (Math.PI / 3)) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;
    const hSector = Math.floor(h / (Math.PI / 3));

    switch (hSector) {
      case 0: [r, g, b] = [c, x, 0]; break;
      case 1: [r, g, b] = [x, c, 0]; break;
      case 2: [r, g, b] = [0, c, x]; break;
      case 3: [r, g, b] = [0, x, c]; break;
      case 4: [r, g, b] = [x, 0, c]; break;
      case 5: [r, g, b] = [c, 0, x]; break;
    }

    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  private applyBlur(imageData: ImageData, radius: number): void {
    // Simple box blur implementation
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const original = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              r += original[idx];
              g += original[idx + 1];
              b += original[idx + 2];
              a += original[idx + 3];
              count++;
            }
          }
        }

        const idx = (y * width + x) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
        data[idx + 3] = a / count;
      }
    }
  }

  private applySharpen(imageData: ImageData, intensity: number): void {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const original = new Uint8ClampedArray(data);

    // Sharpen kernel
    const kernel = [
      0, -intensity, 0,
      -intensity, 1 + 4 * intensity, -intensity,
      0, -intensity, 0
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) { // RGB channels only
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += original[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const idx = (y * width + x) * 4 + c;
          data[idx] = Math.max(0, Math.min(255, sum));
        }
      }
    }
  }

  private applyNoiseReduction(imageData: ImageData, strength: number): void {
    // Simple median filter for noise reduction
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const original = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) { // RGB channels only
          const neighbors = [];
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const idx = ((y + dy) * width + (x + dx)) * 4 + c;
              neighbors.push(original[idx]);
            }
          }
          
          neighbors.sort((a, b) => a - b);
          const median = neighbors[Math.floor(neighbors.length / 2)];
          const current = original[(y * width + x) * 4 + c];
          
          // Blend between original and median based on strength
          const idx = (y * width + x) * 4 + c;
          data[idx] = current + (median - current) * strength;
        }
      }
    }
  }

  private calculateTotalDuration(clips: VideoClip[]): number {
    let maxEndTime = 0;
    for (const clip of clips) {
      maxEndTime = Math.max(maxEndTime, clip.endTime);
    }
    return maxEndTime;
  }

  private async ensureVideoReady(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      console.log(`📼 Checking video readyState: ${video.readyState} for ${video.src}`);
      
      // ReadyState values:
      // 0 = HAVE_NOTHING - no information about the media resource
      // 1 = HAVE_METADATA - enough metadata to seek to any position
      // 2 = HAVE_CURRENT_DATA - data for current playback position available
      // 3 = HAVE_FUTURE_DATA - data for current and some future positions available  
      // 4 = HAVE_ENOUGH_DATA - enough data to play through without stalling
      
      if (video.readyState >= 2) {
        console.log(`📼 Video already ready (readyState: ${video.readyState})`);
        resolve();
        return;
      }
      
      console.log(`📼 Video not ready (readyState: ${video.readyState}), waiting for data...`);
      
      const onLoadedData = () => {
        console.log(`📼 Video data loaded (readyState: ${video.readyState})`);
        cleanup();
        resolve();
      };
      
      const onCanPlay = () => {
        console.log(`📼 Video can play (readyState: ${video.readyState})`);
        cleanup();
        resolve();
      };
      
      const onError = () => {
        console.error(`📼 Video loading error for ${video.src}`);
        cleanup();
        resolve(); // Resolve anyway to continue
      };
      
      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
        clearTimeout(timeoutId);
      };
      
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('error', onError);
      
      // Timeout fallback after 5 seconds
      const timeoutId = setTimeout(() => {
        console.warn(`📼 Video loading timeout after 5s, proceeding anyway (readyState: ${video.readyState})`);
        cleanup();
        resolve();
      }, 5000);
      
      // Try to trigger loading by setting preload and calling load()
      video.preload = 'auto';
      video.load();
    });
  }
}

export const frameExtractionService = new FrameExtractionService();