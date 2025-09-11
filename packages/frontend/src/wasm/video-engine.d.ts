// TypeScript definitions for video-engine WASM module

export interface VideoEngineModule {
  // Memory management
  _malloc(size: number): number;
  _free(ptr: number): void;
  
  // Core functions
  ccall: (name: string, returnType: string, argTypes: string[], args: any[]) => any;
  cwrap: (name: string, returnType: string, argTypes: string[]) => Function;
  
  
  // Memory views
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  HEAP8: Int8Array;
}

export interface VideoDecoder {
  ptr: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
}

export interface VideoFrame {
  ptr: number;
  data: Uint8Array;
  width: number;
  height: number;
  timestamp: number;
}

export interface ColorCorrectionParams {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  gamma: number;
  exposure: number;
}

export interface BlurParams {
  radius: number;
  iterations: number;
  gaussian: boolean;
}

export declare function loadVideoEngine(): Promise<VideoEngineModule>;