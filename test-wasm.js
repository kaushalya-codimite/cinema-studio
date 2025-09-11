// Quick test script for WASM module
import VideoEngine from './packages/frontend/src/wasm/video-engine.js';

async function test() {
  try {
    console.log('Testing WASM module...');
    const wasmModule = await VideoEngine();
    
    console.log('WASM module loaded successfully!');
    console.log('Available functions:', Object.keys(wasmModule).filter(key => typeof wasmModule[key] === 'function').slice(0, 10));
    
    // Test basic functionality
    const version = wasmModule.ccall('video_engine_version', 'string', [], []);
    console.log('Engine version:', version);
    
    // Test decoder creation
    const decoderPtr = wasmModule.ccall('js_video_decoder_create', 'number', [], []);
    console.log('Decoder created:', decoderPtr);
    
    if (decoderPtr) {
      wasmModule.ccall('js_video_decoder_destroy', 'void', ['number'], [decoderPtr]);
      console.log('Decoder destroyed successfully');
    }
    
    console.log('✅ WASM module test completed successfully!');
  } catch (error) {
    console.error('❌ WASM module test failed:', error);
  }
}

test();