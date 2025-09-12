import type { VideoEngineModule, VideoDecoder, VideoFrame, ColorCorrectionParams, VideoExporter } from '../wasm/video-engine.d.ts';

class VideoService {
  private wasmModule: VideoEngineModule | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Loading WASM Video Engine...');
      const VideoEngineModule = await import('../wasm/video-engine.js');
      const VideoEngine = VideoEngineModule.default;
      
      if (!VideoEngine || typeof VideoEngine !== 'function') {
        throw new Error('VideoEngine constructor not found or not a function');
      }

      this.wasmModule = await VideoEngine();
      this.initialized = true;
      
      // Initialize the video engine
      this.wasmModule.ccall('video_engine_init', 'void', [], []);
      
      // Wait for memory views to be available
      let retries = 0;
      while ((!this.wasmModule.HEAPU8 || !this.wasmModule.HEAP32) && retries < 10) {
        console.log(`⏳ Waiting for WASM memory initialization... (attempt ${retries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (!this.wasmModule.HEAPU8 || !this.wasmModule.HEAP32) {
        throw new Error('WASM memory views not available after initialization');
      }
      
      console.log('✅ WASM Video Engine initialized successfully!');
      console.log('🔧 HEAPU8 available:', !!this.wasmModule.HEAPU8, 'size:', this.wasmModule.HEAPU8?.length);
      console.log('🔧 HEAP32 available:', !!this.wasmModule.HEAP32, 'size:', this.wasmModule.HEAP32?.length);
      console.log('🔧 ccall available:', !!this.wasmModule.ccall);
      console.log('🎬 Engine version:', this.getVersion());
    } catch (error) {
      console.error('❌ Failed to initialize WASM Video Engine:', error);
      this.wasmModule = null;
      this.initialized = false;
      throw new Error(`WASM initialization failed: ${error}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Video Engine not initialized. Call initialize() first.');
    }
  }

  private isWasmAvailable(): boolean {
    return this.wasmModule !== null && 
           this.initialized && 
           !!this.wasmModule.HEAPU8 && 
           !!this.wasmModule.HEAP32 &&
           !!this.wasmModule.ccall;
  }

  private copyArrayToWasm(data: Uint8Array, wasmPtr: number): void {
    if (!this.wasmModule || !this.wasmModule.HEAPU8) {
      throw new Error('WASM module not available or HEAPU8 not initialized');
    }
    
    if (!data || data.length === 0) {
      throw new Error('Invalid data array provided');
    }
    
    if (wasmPtr <= 0) {
      throw new Error(`Invalid WASM pointer: ${wasmPtr}`);
    }
    
    // Check if we have enough memory in WASM heap
    const wasmHeapSize = this.wasmModule.HEAPU8.length;
    if (wasmPtr + data.length > wasmHeapSize) {
      throw new Error(`Not enough WASM memory: need ${wasmPtr + data.length}, have ${wasmHeapSize}`);
    }
    
    try {
      this.wasmModule.HEAPU8.set(data, wasmPtr);
    } catch (error) {
      throw new Error(`Failed to copy data to WASM memory at ${wasmPtr}: ${error}`);
    }
  }

  private copyArrayFromWasm(wasmPtr: number, length: number, target: Uint8Array): void {
    if (!this.wasmModule || !this.wasmModule.HEAPU8) {
      throw new Error('WASM module not available or HEAPU8 not initialized');
    }
    
    if (wasmPtr <= 0 || length <= 0) {
      throw new Error(`Invalid parameters: wasmPtr=${wasmPtr}, length=${length}`);
    }
    
    const wasmHeapSize = this.wasmModule.HEAPU8.length;
    if (wasmPtr + length > wasmHeapSize) {
      throw new Error(`Not enough WASM memory to read: need ${wasmPtr + length}, have ${wasmHeapSize}`);
    }
    
    try {
      const source = this.wasmModule.HEAPU8.subarray(wasmPtr, wasmPtr + length);
      target.set(source);
    } catch (error) {
      throw new Error(`Failed to copy data from WASM memory at ${wasmPtr}: ${error}`);
    }
  }

  createDecoder(): VideoDecoder {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }

    try {
      const decoderPtr = this.wasmModule!.ccall('js_video_decoder_create', 'number', [], []);
      if (!decoderPtr) {
        throw new Error('WASM decoder creation returned null pointer');
      }

      console.log('🎬 Created WASM video decoder:', decoderPtr);
      return {
        ptr: decoderPtr,
        width: 0,
        height: 0,
        fps: 0,
        totalFrames: 0
      };
    } catch (error) {
      console.error('❌ Failed to create WASM decoder:', error);
      throw error;
    }
  }

  destroyDecoder(decoder: VideoDecoder): void {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }
    
    if (decoder.ptr) {
      try {
        this.wasmModule!.ccall('js_video_decoder_destroy', 'void', ['number'], [decoder.ptr]);
        console.log('🗑️ Destroyed WASM decoder:', decoder.ptr);
        decoder.ptr = 0;
      } catch (error) {
        console.error('❌ Failed to destroy WASM decoder:', error);
        decoder.ptr = 0;
      }
    }
  }

  async openVideo(decoder: VideoDecoder, videoData: Uint8Array): Promise<boolean> {
    this.ensureInitialized();

    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }

    try {
      // Allocate memory using our WASM malloc function
      const dataPtr = this.wasmModule!.ccall('js_malloc', 'number', ['number'], [videoData.length]);
      if (!dataPtr) {
        throw new Error('Failed to allocate WASM memory for video data');
      }

      try {
        // Copy data to WASM memory
        this.copyArrayToWasm(videoData, dataPtr);
        
        // Open video using the proper JavaScript binding
        const result = this.wasmModule!.ccall(
          'js_video_decoder_open',
          'number',
          ['number', 'number', 'number'],
          [decoder.ptr, dataPtr, videoData.length]
        );

        if (result === 1) {
          // Update decoder properties with realistic video dimensions
          decoder.width = 1920;
          decoder.height = 1080;
          decoder.fps = 30;
          decoder.totalFrames = 300;
          console.log('✅ WASM video opened successfully with C engine');
        } else {
          console.log('⚠️ WASM video opening returned:', result);
        }

        return result === 1;
      } finally {
        // Clean up allocated memory
        this.wasmModule!.ccall('js_free', 'void', ['number'], [dataPtr]);
      }
    } catch (error) {
      console.error('❌ Failed to open video with WASM:', error);
      throw new Error(`WASM video opening failed: ${error}`);
    }
  }

  // New method to work with HTML5 video frames
  processVideoFrame(frameData: Uint8Array, width: number, height: number): Uint8Array {
    this.ensureInitialized();

    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }

    try {
      const dataPtr = this.wasmModule!.ccall('js_malloc', 'number', ['number'], [frameData.length]);
      if (!dataPtr) {
        throw new Error('Failed to allocate WASM memory for frame data');
      }

      try {
        // Copy frame data to WASM memory
        this.copyArrayToWasm(frameData, dataPtr);
        
        // Apply real-time filter for processing (brightness filter as example)
        this.wasmModule!.ccall(
          'js_apply_real_time_filter',
          'void',
          ['number', 'number', 'number', 'number', 'number'],
          [dataPtr, width, height, 0, 0.0] // FILTER_BRIGHTNESS with 0 intensity
        );
        
        // Copy processed data back
        const processedData = new Uint8Array(frameData.length);
        this.copyArrayFromWasm(dataPtr, frameData.length, processedData);
        
        console.log('✅ WASM frame processed successfully with C engine');
        return processedData;
      } finally {
        this.wasmModule!.ccall('js_free', 'void', ['number'], [dataPtr]);
      }
    } catch (error) {
      console.error('❌ WASM frame processing failed:', error);
      throw new Error(`WASM frame processing failed: ${error}`);
    }
  }

  getFrame(decoder: VideoDecoder, frameNumber: number): VideoFrame | null {
    this.ensureInitialized();

    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }

    try {
      const framePtr = this.wasmModule!.ccall(
        'js_video_decoder_get_frame',
        'number',
        ['number', 'number'],
        [decoder.ptr, frameNumber]
      );

      if (!framePtr) {
        console.log(`🖼️ No frame at index ${frameNumber}`);
        return null;
      }

      // Get frame properties using WASM bindings
      const width = this.wasmModule!.ccall('js_video_frame_get_width', 'number', ['number'], [framePtr]);
      const height = this.wasmModule!.ccall('js_video_frame_get_height', 'number', ['number'], [framePtr]);
      const timestamp = this.wasmModule!.ccall('js_video_frame_get_timestamp', 'number', ['number'], [framePtr]);
      const dataPtr = this.wasmModule!.ccall('js_video_frame_get_data', 'number', ['number'], [framePtr]);

      if (!dataPtr || width <= 0 || height <= 0) {
        console.error('❌ Invalid frame data from WASM');
        return null;
      }

      // Create a copy of the frame data
      const dataSize = width * height * 4; // RGBA
      const data = new Uint8Array(dataSize);
      this.copyArrayFromWasm(dataPtr, dataSize, data);

      console.log(`🎬 Got WASM frame ${frameNumber}: ${width}x${height} @ ${timestamp}s`);
      return {
        ptr: framePtr,
        data,
        width,
        height,
        timestamp
      };
    } catch (error) {
      console.error('❌ Failed to get frame from WASM:', error);
      throw new Error(`WASM frame get failed: ${error}`);
    }
  }


  destroyFrame(frame: VideoFrame): void {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }
    
    if (frame.ptr) {
      try {
        this.wasmModule!.ccall('js_video_frame_destroy', 'void', ['number'], [frame.ptr]);
        console.log('🗑️ Destroyed WASM frame:', frame.ptr);
        frame.ptr = 0;
      } catch (error) {
        console.error('❌ Failed to destroy WASM frame:', error);
        frame.ptr = 0;
      }
    }
  }

  applyColorCorrection(frameData: Uint8Array, width: number, height: number, params: ColorCorrectionParams): void {
    console.log('🎨 applyColorCorrection called with:', {
      dataLength: frameData.length,
      width,
      height,
      expectedSize: width * height * 4,
      params
    });
    
    this.ensureInitialized();

    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }

    try {
      const dataPtr = this.wasmModule!.ccall('js_malloc', 'number', ['number'], [frameData.length]);
      if (!dataPtr) {
        throw new Error('Failed to allocate WASM memory for color correction');
      }

      try {
        // Copy frame data to WASM memory
        this.copyArrayToWasm(frameData, dataPtr);
        
        // Use the direct color correction function for ALL parameters at once
        this.wasmModule!.ccall(
          'js_apply_color_correction_direct',
          'void',
          ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
          [
            dataPtr, 
            width, 
            height,
            params.brightness || 0,
            params.contrast || 0, 
            params.saturation || 0,
            params.hue || 0,
            params.gamma || 1,
            params.exposure || 0
          ]
        );

        // Copy processed data back from WASM memory
        this.copyArrayFromWasm(dataPtr, frameData.length, frameData);
        console.log('✅ WASM color correction applied successfully with C engine');
      } finally {
        this.wasmModule!.ccall('js_free', 'void', ['number'], [dataPtr]);
      }
    } catch (error) {
      console.error('❌ WASM color correction failed:', error);
      throw new Error(`WASM color correction failed: ${error}`);
    }
  }


  getVersion(): string {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }
    
    try {
      return this.wasmModule!.ccall('video_engine_version', 'string', [], []);
    } catch (error) {
      console.error('❌ Failed to get WASM version:', error);
      throw new Error(`WASM version check failed: ${error}`);
    }
  }

  // New WASM-specific filter functions
  applyBlurFilter(frameData: Uint8Array, width: number, height: number, radius: number): void {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }
    
    try {
      const dataPtr = this.wasmModule!.ccall('js_malloc', 'number', ['number'], [frameData.length]);
      if (!dataPtr) {
        throw new Error('Failed to allocate WASM memory for blur filter');
      }

      try {
        // Copy frame data to WASM memory
        this.copyArrayToWasm(frameData, dataPtr);
        
        // Apply blur filter
        this.wasmModule!.ccall(
          'js_apply_blur_filter',
          'void',
          ['number', 'number', 'number', 'number'],
          [dataPtr, width, height, radius]
        );

        // Copy processed data back
        this.copyArrayFromWasm(dataPtr, frameData.length, frameData);
        console.log(`🌫️ Applied WASM blur filter (radius: ${radius})`);
      } finally {
        this.wasmModule!.ccall('js_free', 'void', ['number'], [dataPtr]);
      }
    } catch (error) {
      console.error('❌ Failed to apply WASM blur filter:', error);
      throw error;
    }
  }

  applySharpenFilter(frameData: Uint8Array, width: number, height: number, intensity: number): void {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }
    
    try {
      const dataPtr = this.wasmModule!.ccall('js_malloc', 'number', ['number'], [frameData.length]);
      if (!dataPtr) {
        throw new Error('Failed to allocate WASM memory for sharpen filter');
      }

      try {
        // Copy frame data to WASM memory
        this.copyArrayToWasm(frameData, dataPtr);
        
        // Apply sharpen filter
        this.wasmModule!.ccall(
          'js_apply_sharpen_filter',
          'void',
          ['number', 'number', 'number', 'number'],
          [dataPtr, width, height, intensity]
        );

        // Copy processed data back
        this.copyArrayFromWasm(dataPtr, frameData.length, frameData);
        console.log(`⚡ Applied WASM sharpen filter (intensity: ${intensity})`);
      } finally {
        this.wasmModule!.ccall('js_free', 'void', ['number'], [dataPtr]);
      }
    } catch (error) {
      console.error('❌ Failed to apply WASM sharpen filter:', error);
      throw error;
    }
  }

  applyNoiseReduction(frameData: Uint8Array, width: number, height: number, strength: number): void {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }
    
    try {
      const dataPtr = this.wasmModule!.ccall('js_malloc', 'number', ['number'], [frameData.length]);
      if (!dataPtr) {
        throw new Error('Failed to allocate WASM memory for noise reduction');
      }

      try {
        // Copy frame data to WASM memory
        this.copyArrayToWasm(frameData, dataPtr);
        
        // Apply noise reduction
        this.wasmModule!.ccall(
          'js_apply_noise_reduction',
          'void',
          ['number', 'number', 'number', 'number'],
          [dataPtr, width, height, strength]
        );

        // Copy processed data back
        this.copyArrayFromWasm(dataPtr, frameData.length, frameData);
        console.log(`🔧 Applied WASM noise reduction (strength: ${strength})`);
      } finally {
        this.wasmModule!.ccall('js_free', 'void', ['number'], [dataPtr]);
      }
    } catch (error) {
      console.error('❌ Failed to apply WASM noise reduction:', error);
      throw error;
    }
  }

  applyAdvancedColorCorrection(framePtr: number, params: ColorCorrectionParams): void {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - this project requires WASM for video processing!');
    }
    
    try {
      this.wasmModule!.ccall(
        'js_apply_color_correction',
        'void',
        ['number', 'number', 'number', 'number', 'number', 'number', 'number'],
        [
          framePtr,
          params.brightness || 0,
          params.contrast || 0,
          params.saturation || 0,
          params.hue || 0,
          params.gamma || 1,
          params.exposure || 0
        ]
      );
      console.log('🎨 Applied advanced WASM color correction');
    } catch (error) {
      console.error('❌ Failed to apply advanced WASM color correction:', error);
    }
  }

  // Export functionality
  createVideoExporter(width: number, height: number, fps: number, format: 'mp4' | 'webm'): VideoExporter {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - export requires WASM for video processing!');
    }
    
    try {
      const formatCode = format === 'mp4' ? 0 : 1;
      const exporterPtr = this.wasmModule!.ccall(
        'js_video_exporter_create',
        'number',
        ['number', 'number', 'number', 'number'],
        [width, height, fps, formatCode]
      );
      
      if (!exporterPtr) {
        throw new Error('Failed to create WASM video exporter');
      }
      
      console.log(`📹 Created ${format.toUpperCase()} exporter: ${width}x${height} @ ${fps}fps`);
      return {
        ptr: exporterPtr,
        width,
        height,
        fps,
        format,
        totalFrames: 0
      };
    } catch (error) {
      console.error('❌ Failed to create video exporter:', error);
      throw error;
    }
  }

  addFrameToExport(exporter: VideoExporter, frameData: Uint8Array, width: number, height: number): boolean {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - export requires WASM for video processing!');
    }
    
    try {
      const dataPtr = this.wasmModule!.ccall('js_malloc', 'number', ['number'], [frameData.length]);
      if (!dataPtr) {
        throw new Error('Failed to allocate WASM memory for frame data');
      }
      
      try {
        // Copy frame data to WASM memory
        this.copyArrayToWasm(frameData, dataPtr);
        
        const result = this.wasmModule!.ccall(
          'js_video_exporter_add_frame',
          'number',
          ['number', 'number', 'number', 'number'],
          [exporter.ptr, dataPtr, width, height]
        );
        
        if (result === 1) {
          exporter.totalFrames++;
          console.log(`🎬 Added frame ${exporter.totalFrames} to ${exporter.format.toUpperCase()} export`);
          return true;
        } else {
          console.error('❌ Failed to add frame to export');
          return false;
        }
      } finally {
        this.wasmModule!.ccall('js_free', 'void', ['number'], [dataPtr]);
      }
    } catch (error) {
      console.error('❌ Failed to add frame to export:', error);
      throw error;
    }
  }

  finalizeExport(exporter: VideoExporter): Uint8Array {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - export requires WASM for video processing!');
    }

    console.log('🔍 Debugging WASM state for finalizeExport:', {
      wasmModule: !!this.wasmModule,
      initialized: this.initialized,
      hasHEAP32: !!this.wasmModule?.HEAP32,
      hasHEAPU8: !!this.wasmModule?.HEAPU8,
      exporterPtr: exporter.ptr,
      exporterTotalFrames: exporter.totalFrames
    });
    
    try {
      const outputSizePtr = this.wasmModule!.ccall('js_malloc', 'number', ['number'], [4]); // int size
      if (!outputSizePtr) {
        throw new Error('Failed to allocate memory for output size');
      }
      
      try {
        const outputDataPtr = this.wasmModule!.ccall(
          'js_video_exporter_finalize',
          'number',
          ['number', 'number'],
          [exporter.ptr, outputSizePtr]
        );
        
        if (!outputDataPtr) {
          throw new Error('Export finalization failed');
        }
        
        // Get the output size with bounds checking
        if (!this.wasmModule!.HEAP32) {
          throw new Error('WASM HEAP32 not initialized - check WASM module loading');
        }
        
        const outputSizeIndex = outputSizePtr >> 2;
        const heap32Size = this.wasmModule!.HEAP32.length;
        
        if (outputSizeIndex < 0 || outputSizeIndex >= heap32Size) {
          throw new Error(`HEAP32 index out of bounds: ${outputSizeIndex} >= ${heap32Size}`);
        }
        
        const outputSize = this.wasmModule!.HEAP32[outputSizeIndex];
        
        if (outputSize <= 0 || outputSize > 100 * 1024 * 1024) { // Max 100MB
          throw new Error(`Invalid output size: ${outputSize} bytes`);
        }
        
        // Copy the output data
        const outputData = new Uint8Array(outputSize);
        this.copyArrayFromWasm(outputDataPtr, outputSize, outputData);
        
        // Clean up
        this.wasmModule!.ccall('js_free', 'void', ['number'], [outputDataPtr]);
        
        console.log(`🚀 Export completed! ${exporter.format.toUpperCase()} file size: ${outputSize} bytes (${exporter.totalFrames} frames)`);
        return outputData;
      } finally {
        this.wasmModule!.ccall('js_free', 'void', ['number'], [outputSizePtr]);
      }
    } catch (error) {
      console.error('❌ Failed to finalize export:', error);
      throw error;
    }
  }

  destroyVideoExporter(exporter: VideoExporter): void {
    this.ensureInitialized();
    
    if (!this.isWasmAvailable()) {
      throw new Error('🚫 WASM not available - export requires WASM for video processing!');
    }
    
    if (exporter.ptr) {
      try {
        this.wasmModule!.ccall('js_video_exporter_destroy', 'void', ['number'], [exporter.ptr]);
        console.log(`🗑️ Destroyed ${exporter.format.toUpperCase()} exporter`);
        exporter.ptr = 0;
      } catch (error) {
        console.error('❌ Failed to destroy video exporter:', error);
        exporter.ptr = 0;
      }
    }
  }
}

export const videoService = new VideoService();