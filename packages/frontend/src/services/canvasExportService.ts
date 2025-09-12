export interface CanvasExportOptions {
  format: 'webm' | 'mp4';
  fps: number;
  width: number;
  height: number;
  quality?: number; // 0.1 to 1.0
}

export class CanvasExportService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  async exportVideo(
    frames: ImageData[],
    options: CanvasExportOptions,
    onProgress?: (progress: number) => void
  ): Promise<Uint8Array> {
    console.log(`🎬 Starting ${options.format.toUpperCase()} export with Canvas MediaRecorder`);
    
    if (frames.length === 0) {
      throw new Error('No frames to export');
    }

    // Set canvas dimensions
    this.canvas.width = options.width;
    this.canvas.height = options.height;

    // Check MediaRecorder support
    const mimeType = options.format === 'webm' ? 'video/webm;codecs=vp9' : 'video/mp4;codecs=h264';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      // Fallback to webm with vp8 if vp9 not supported
      const fallbackMime = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(fallbackMime)) {
        throw new Error('Browser does not support video recording. Please use a modern browser like Chrome or Firefox.');
      }
      console.warn('VP9 not supported, falling back to VP8');
    }

    // Create video stream from canvas
    const stream = this.canvas.captureStream(options.fps);
    
    return new Promise((resolve, reject) => {
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm;codecs=vp8',
        videoBitsPerSecond: this.calculateBitrate(options)
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          resolve(uint8Array);
        } catch (error) {
          reject(error);
        }
      };

      recorder.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${(event as any).error}`));
      };

      // Start recording
      recorder.start();

      // Render frames at specified FPS
      this.renderFramesSequentially(frames, options, onProgress)
        .then(() => {
          // Stop recording after all frames are rendered
          setTimeout(() => {
            recorder.stop();
            stream.getTracks().forEach(track => track.stop());
          }, 500); // Give a bit of time for the last frame
        })
        .catch(reject);
    });
  }

  private async renderFramesSequentially(
    frames: ImageData[],
    options: CanvasExportOptions,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const frameDuration = 1000 / options.fps; // ms per frame
    console.log(`🎬 Starting frame sequence render: ${frames.length} frames at ${options.fps}fps`);
    console.log(`⏱️ Frame duration: ${frameDuration}ms per frame`);

    for (let i = 0; i < frames.length; i++) {
      const startTime = performance.now();
      
      // Clear canvas with black background
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, options.width, options.height);
      
      // Render frame - sample some pixels to verify frame uniqueness
      this.ctx.putImageData(frames[i], 0, 0);
      
      // Force canvas to update by requesting animation frame
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Sample center pixel to verify frame data changes
      const centerPixel = this.ctx.getImageData(options.width / 2, options.height / 2, 1, 1);
      const r = centerPixel.data[0], g = centerPixel.data[1], b = centerPixel.data[2];

      // Update progress
      const progress = ((i + 1) / frames.length) * 100;
      onProgress?.(progress);

      // Wait for frame duration to maintain proper FPS, ensuring MediaRecorder captures the frame
      await this.waitForNextFrame(frameDuration);
      
      const endTime = performance.now();
      const actualDuration = endTime - startTime;

      if (i % 10 === 0 || i === frames.length - 1) {
        console.log(`🎥 Frame ${i + 1}/${frames.length} (${progress.toFixed(1)}%) - Center pixel RGB(${r},${g},${b}) - Duration: ${actualDuration.toFixed(1)}ms`);
      }
    }

    console.log('✅ All frames rendered to canvas stream');
  }

  private async waitForNextFrame(duration: number): Promise<void> {
    return new Promise(resolve => {
      // Use requestAnimationFrame for smoother rendering
      requestAnimationFrame(() => {
        setTimeout(resolve, Math.max(16, duration - 16)); // Subtract ~16ms for RAF
      });
    });
  }

  private calculateBitrate(options: CanvasExportOptions): number {
    // Calculate bitrate based on resolution and quality
    const pixelCount = options.width * options.height;
    const quality = options.quality || 0.7;
    
    // Base bitrate calculation (rough estimate)
    let baseBitrate: number;
    if (pixelCount <= 640 * 480) {
      baseBitrate = 1000000; // 1 Mbps for SD
    } else if (pixelCount <= 1280 * 720) {
      baseBitrate = 2500000; // 2.5 Mbps for 720p
    } else {
      baseBitrate = 5000000; // 5 Mbps for 1080p+
    }

    return Math.round(baseBitrate * quality);
  }
}

export const canvasExportService = new CanvasExportService();