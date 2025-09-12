import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface ExportOptions {
  format: 'mp4' | 'webm';
  fps: number;
  width: number;
  height: number;
  quality?: 'low' | 'medium' | 'high';
}

export class FFmpegExportService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;

  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    console.log('🔧 Initializing FFmpeg.wasm from local files...');
    
    try {
      this.ffmpeg = new FFmpeg();

      // Add progress logging for FFmpeg initialization
      this.ffmpeg.on('log', ({ message }) => {
        console.log('📋 FFmpeg Log:', message);
      });

      console.log('📦 Loading FFmpeg.wasm from local bundle...');
      
      // Use local files instead of CDN for faster, more reliable loading
      const coreURL = '/ffmpeg/ffmpeg-core.js';
      const wasmURL = '/ffmpeg/ffmpeg-core.wasm';
      
      console.log(`📦 Core: ${coreURL}`);
      console.log(`📦 WASM: ${wasmURL}`);
      
      // Convert local files to blob URLs for FFmpeg
      const coreBlobURL = await toBlobURL(coreURL, 'text/javascript');
      const wasmBlobURL = await toBlobURL(wasmURL, 'application/wasm');
      
      console.log('🔄 Loading FFmpeg.wasm core...');
      
      // Add timeout (much shorter since it's local)
      const loadPromise = this.ffmpeg.load({
        coreURL: coreBlobURL,
        wasmURL: wasmBlobURL,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('FFmpeg loading timeout (10s)')), 10000)
      );
      
      await Promise.race([loadPromise, timeoutPromise]);
      
      this.isLoaded = true;
      console.log('✅ FFmpeg.wasm loaded successfully from local files!');
      return;
      
    } catch (error) {
      console.error('❌ FFmpeg.wasm initialization failed:', error);
      this.isLoaded = false;
      this.ffmpeg = null;
      throw new Error(`FFmpeg.wasm initialization failed: ${error}`);
    }
  }

  async exportVideo(
    frames: ImageData[],
    options: ExportOptions,
    onProgress?: (progress: number) => void
  ): Promise<Uint8Array> {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new Error('FFmpeg not initialized. Call initialize() first.');
    }

    console.log(`🎬 Starting ${options.format.toUpperCase()} export with ${frames.length} frames`);

    try {
      // Create canvas for frame processing
      const canvas = document.createElement('canvas');
      canvas.width = options.width;
      canvas.height = options.height;
      const ctx = canvas.getContext('2d')!;

      // Convert frames to PNG images and write to FFmpeg
      for (let i = 0; i < frames.length; i++) {
        // Put frame data on canvas
        ctx.putImageData(frames[i], 0, 0);
        
        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(resolve as any, 'image/png');
        });

        if (!blob) throw new Error(`Failed to convert frame ${i} to blob`);

        // Write frame to FFmpeg virtual filesystem
        const frameFilename = `frame_${i.toString().padStart(6, '0')}.png`;
        await this.ffmpeg.writeFile(frameFilename, await fetchFile(blob));

        // Report progress
        const progressPercent = ((i + 1) / frames.length) * 50; // First 50% is frame preparation
        onProgress?.(progressPercent);
        
        if (i % 10 === 0) {
          console.log(`📸 Processed frame ${i + 1}/${frames.length}`);
        }
      }

      // Build FFmpeg command based on format and quality
      const outputFilename = `output.${options.format}`;
      const ffmpegArgs = this.buildFFmpegArgs(frames.length, options, outputFilename);

      console.log('🔧 FFmpeg command:', ffmpegArgs.join(' '));
      console.log('🎥 Starting video encoding...');

      // Execute FFmpeg conversion
      await this.ffmpeg.exec(ffmpegArgs);

      onProgress?.(100);
      console.log('✅ Video encoding completed');

      // Read the output file
      const outputData = await this.ffmpeg.readFile(outputFilename) as Uint8Array;
      
      // Clean up input frames from FFmpeg filesystem
      for (let i = 0; i < frames.length; i++) {
        const frameFilename = `frame_${i.toString().padStart(6, '0')}.png`;
        try {
          await this.ffmpeg.deleteFile(frameFilename);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Clean up output file
      try {
        await this.ffmpeg.deleteFile(outputFilename);
      } catch (e) {
        // Ignore cleanup errors
      }

      console.log(`🚀 Export completed! File size: ${outputData.length} bytes`);
      return outputData;

    } catch (error) {
      console.error('❌ FFmpeg export failed:', error);
      throw new Error(`Video export failed: ${error}`);
    }
  }

  private buildFFmpegArgs(frameCount: number, options: ExportOptions, outputFilename: string): string[] {
    const args = [
      '-f', 'image2',           // Input format: image sequence
      '-r', options.fps.toString(), // Input framerate
      '-i', 'frame_%06d.png',   // Input filename pattern
      '-pix_fmt', 'yuv420p',    // Pixel format for compatibility
    ];

    if (options.format === 'mp4') {
      args.push(
        '-c:v', 'libx264',      // H.264 codec
        '-preset', this.getPresetForQuality(options.quality || 'medium'),
        '-crf', this.getCRFForQuality(options.quality || 'medium').toString()
      );
    } else if (options.format === 'webm') {
      args.push(
        '-c:v', 'libvpx-vp9',   // VP9 codec for WebM
        '-b:v', this.getBitrateForQuality(options.quality || 'medium', options.width, options.height),
        '-crf', '30'            // Quality setting
      );
    }

    // Add output framerate and filename
    args.push('-r', options.fps.toString(), outputFilename);

    return args;
  }

  private getPresetForQuality(quality: string): string {
    switch (quality) {
      case 'low': return 'ultrafast';
      case 'high': return 'slow';
      default: return 'medium';
    }
  }

  private getCRFForQuality(quality: string): number {
    switch (quality) {
      case 'low': return 28;
      case 'high': return 18;
      default: return 23;
    }
  }

  private getBitrateForQuality(quality: string, width: number, height: number): string {
    const pixelCount = width * height;
    const baseRate = pixelCount / (1280 * 720); // Normalize to 720p
    
    let multiplier: number;
    switch (quality) {
      case 'low': multiplier = 0.5; break;
      case 'high': multiplier = 2.0; break;
      default: multiplier = 1.0; break;
    }

    const bitrate = Math.round(1000 * baseRate * multiplier); // Base 1Mbps for 720p
    return `${bitrate}k`;
  }

  async terminate(): Promise<void> {
    if (this.ffmpeg && this.isLoaded) {
      await this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.isLoaded = false;
      console.log('🗑️ FFmpeg.wasm terminated');
    }
  }
}

export const ffmpegExportService = new FFmpegExportService();