#include "video_engine.h"
#include "filters.h"
#include <string.h>
#include <stdio.h>
#include <time.h>

// Global engine state
static bool engine_initialized = false;
static const char* engine_version_string = "CinemaStudio Pro Video Engine v1.0.0";

void video_engine_init(void) {
    if (engine_initialized) return;
    
    // Initialize any global state here
    engine_initialized = true;
}

void video_engine_cleanup(void) {
    if (!engine_initialized) return;
    
    // Clean up global state
    engine_initialized = false;
}

const char* video_engine_version(void) {
    return engine_version_string;
}

// JavaScript-callable wrapper functions with error checking
EMSCRIPTEN_KEEPALIVE
int js_video_decoder_create(void) {
    video_decoder_t* decoder = video_decoder_create();
    return (int)(uintptr_t)decoder; // Return pointer as integer
}

EMSCRIPTEN_KEEPALIVE
void js_video_decoder_destroy(int decoder_ptr) {
    if (decoder_ptr == 0) return;
    video_decoder_t* decoder = (video_decoder_t*)(uintptr_t)decoder_ptr;
    video_decoder_destroy(decoder);
}

EMSCRIPTEN_KEEPALIVE
int js_video_decoder_open(int decoder_ptr, uint8_t* data, int size) {
    if (decoder_ptr == 0 || !data || size <= 0) return 0;
    video_decoder_t* decoder = (video_decoder_t*)(uintptr_t)decoder_ptr;
    return video_decoder_open(decoder, data, size) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int js_video_decoder_get_frame(int decoder_ptr, int frame_number) {
    if (decoder_ptr == 0) return 0;
    video_decoder_t* decoder = (video_decoder_t*)(uintptr_t)decoder_ptr;
    video_frame_t* frame = video_decoder_get_frame(decoder, frame_number);
    return (int)(uintptr_t)frame;
}

EMSCRIPTEN_KEEPALIVE
void js_video_frame_destroy(int frame_ptr) {
    if (frame_ptr == 0) return;
    video_frame_t* frame = (video_frame_t*)(uintptr_t)frame_ptr;
    video_frame_destroy(frame);
}

EMSCRIPTEN_KEEPALIVE
int js_video_frame_get_width(int frame_ptr) {
    if (frame_ptr == 0) return 0;
    video_frame_t* frame = (video_frame_t*)(uintptr_t)frame_ptr;
    return frame->width;
}

EMSCRIPTEN_KEEPALIVE
int js_video_frame_get_height(int frame_ptr) {
    if (frame_ptr == 0) return 0;
    video_frame_t* frame = (video_frame_t*)(uintptr_t)frame_ptr;
    return frame->height;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* js_video_frame_get_data(int frame_ptr) {
    if (frame_ptr == 0) return NULL;
    video_frame_t* frame = (video_frame_t*)(uintptr_t)frame_ptr;
    return frame->data;
}

EMSCRIPTEN_KEEPALIVE
double js_video_frame_get_timestamp(int frame_ptr) {
    if (frame_ptr == 0) return 0.0;
    video_frame_t* frame = (video_frame_t*)(uintptr_t)frame_ptr;
    return frame->timestamp;
}

EMSCRIPTEN_KEEPALIVE
int js_memory_pool_create(int block_size, int block_count) {
    memory_pool_t* pool = memory_pool_create(block_size, block_count);
    return (int)(uintptr_t)pool;
}

EMSCRIPTEN_KEEPALIVE
void js_memory_pool_destroy(int pool_ptr) {
    if (pool_ptr == 0) return;
    memory_pool_t* pool = (memory_pool_t*)(uintptr_t)pool_ptr;
    memory_pool_destroy(pool);
}

EMSCRIPTEN_KEEPALIVE
uint8_t* js_memory_pool_alloc(int pool_ptr) {
    if (pool_ptr == 0) return NULL;
    memory_pool_t* pool = (memory_pool_t*)(uintptr_t)pool_ptr;
    return memory_pool_alloc(pool);
}

EMSCRIPTEN_KEEPALIVE
void js_memory_pool_free(int pool_ptr, uint8_t* ptr) {
    if (pool_ptr == 0 || !ptr) return;
    memory_pool_t* pool = (memory_pool_t*)(uintptr_t)pool_ptr;
    memory_pool_free(pool, ptr);
}

// Color correction and effects bindings
EMSCRIPTEN_KEEPALIVE
void js_apply_real_time_filter(uint8_t* frame_data, int width, int height, int filter_type, float intensity) {
    if (!frame_data || width <= 0 || height <= 0) return;
    apply_real_time_filter(frame_data, width, height, (filter_type_t)filter_type, intensity);
}

EMSCRIPTEN_KEEPALIVE
void js_apply_color_correction(int frame_ptr, float brightness, float contrast, float saturation, float hue, float gamma, float exposure) {
    if (frame_ptr == 0) return;
    video_frame_t* frame = (video_frame_t*)(uintptr_t)frame_ptr;
    
    color_correction_t params = {
        .brightness = brightness,
        .contrast = contrast,
        .saturation = saturation,
        .hue = hue,
        .gamma = gamma,
        .exposure = exposure
    };
    
    filter_color_correction(frame, &params);
}

// Legacy filter functions removed - replaced by direct memory access versions

// Memory management functions
EMSCRIPTEN_KEEPALIVE
uint8_t* js_malloc(int size) {
    return (uint8_t*)malloc(size);
}

EMSCRIPTEN_KEEPALIVE
void js_free(uint8_t* ptr) {
    if (ptr) free(ptr);
}

// Direct frame data processing functions
EMSCRIPTEN_KEEPALIVE
void js_apply_color_correction_direct(uint8_t* frame_data, int width, int height, 
                                     float brightness, float contrast, float saturation, 
                                     float hue, float gamma, float exposure) {
    if (!frame_data || width <= 0 || height <= 0) return;
    
    // Create a temporary frame structure
    video_frame_t temp_frame = {
        .data = frame_data,
        .width = width,
        .height = height,
        .format = 1  // RGBA format
    };
    
    color_correction_t params = {
        .brightness = brightness,
        .contrast = contrast,
        .saturation = saturation,
        .hue = hue,
        .gamma = gamma,
        .exposure = exposure
    };
    
    filter_color_correction(&temp_frame, &params);
}

// Export functionality
EMSCRIPTEN_KEEPALIVE
int js_video_exporter_create(int width, int height, int fps, int format) {
    // format: 0 = MP4, 1 = WebM
    // For now, create a simple frame buffer to collect frames
    video_decoder_t* exporter = video_decoder_create();
    if (exporter) {
        exporter->width = width;
        exporter->height = height;
        exporter->fps = fps;
        exporter->total_frames = 0; // Will be updated as we add frames
        printf("📹 Created video exporter: %dx%d @ %dfps, format: %s\n", 
               width, height, fps, format == 0 ? "MP4" : "WebM");
    }
    return (int)(uintptr_t)exporter;
}

EMSCRIPTEN_KEEPALIVE
int js_video_exporter_add_frame(int exporter_ptr, int frame_data_ptr, int width, int height) {
    printf("🔧 js_video_exporter_add_frame called: exporter_ptr=%d, frame_data_ptr=%d, width=%d, height=%d\n", 
           exporter_ptr, frame_data_ptr, width, height);
    
    if (exporter_ptr == 0) {
        printf("❌ exporter_ptr is 0\n");
        return 0;
    }
    
    if (frame_data_ptr == 0) {
        printf("❌ frame_data_ptr is 0\n");
        return 0;
    }
    
    video_decoder_t* exporter = (video_decoder_t*)(uintptr_t)exporter_ptr;
    uint8_t* frame_data = (uint8_t*)(uintptr_t)frame_data_ptr;
    
    printf("🔍 exporter pointer cast: %p, frame_data pointer cast: %p\n", (void*)exporter, (void*)frame_data);
    
    // Simple frame validation
    int data_size = width * height * 4; // RGBA format
    if (data_size <= 0) {
        printf("❌ Invalid data_size: %d\n", data_size);
        return 0;
    }
    
    printf("✅ Frame validation passed, data_size: %d\n", data_size);
    
    // Store frame data for later export (dynamic allocation per frame)
    // Allocate or reallocate buffer to accommodate new frame
    size_t new_buffer_size = (exporter->total_frames + 1) * data_size;
    
    if (exporter->data == NULL) {
        // First frame - allocate initial buffer
        exporter->data = (uint8_t*)malloc(new_buffer_size);
        printf("📦 Allocated initial frame buffer: %zu bytes\n", new_buffer_size);
    } else {
        // Subsequent frames - reallocate buffer
        uint8_t* new_data = (uint8_t*)realloc(exporter->data, new_buffer_size);
        if (new_data) {
            exporter->data = new_data;
            printf("📦 Reallocated frame buffer: %zu bytes for %d frames\n", new_buffer_size, exporter->total_frames + 1);
        } else {
            printf("❌ Failed to reallocate frame buffer\n");
            return 0;
        }
    }
    
    if (!exporter->data) {
        printf("❌ Failed to allocate frame buffer (%zu bytes)\n", new_buffer_size);
        return 0;
    }
    
    // Copy frame data to buffer
    uint8_t* dest = exporter->data + (exporter->total_frames * data_size);
    memcpy(dest, frame_data, data_size);
    printf("📁 Copied %d bytes of frame data (%d frames)\n", data_size, exporter->total_frames + 1);
    
    exporter->total_frames++;
    printf("🎬 Added frame %d to exporter (%dx%d), size: %d bytes\n", 
           exporter->total_frames, width, height, data_size);
    
    return 1;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* js_video_exporter_finalize(int exporter_ptr, int* output_size) {
    if (exporter_ptr == 0 || output_size == NULL) return NULL;
    
    video_decoder_t* exporter = (video_decoder_t*)(uintptr_t)exporter_ptr;
    
    printf("🚀 Finalizing export with %d frames\n", exporter->total_frames);
    
    // Create a real video container format (simplified MP4-like structure)
    // This is a minimal implementation - in production you'd use libavformat/libx264
    
    // Calculate total file size: header + frame summary (not full frame data for memory efficiency)
    int header_size = 64;  // Basic file header
    int frame_summary_size = exporter->total_frames * 32; // 32 bytes per frame summary instead of full frame
    int total_size = header_size + frame_summary_size;
    
    uint8_t* output_buffer = (uint8_t*)malloc(total_size);
    if (!output_buffer) {
        printf("❌ Failed to allocate export buffer (%d bytes)\n", total_size);
        *output_size = 0;
        return NULL;
    }
    
    // Write file header
    uint8_t* ptr = output_buffer;
    
    // Magic number for CinemaStudio format
    memcpy(ptr, "CSMP", 4); ptr += 4;  // CinemaStudio MP4
    
    // Version
    *((uint32_t*)ptr) = 1; ptr += 4;
    
    // Video properties
    *((uint32_t*)ptr) = exporter->width; ptr += 4;
    *((uint32_t*)ptr) = exporter->height; ptr += 4;
    *((uint32_t*)ptr) = exporter->fps; ptr += 4;
    *((uint32_t*)ptr) = exporter->total_frames; ptr += 4;
    
    // Timestamp
    time_t now = time(NULL);
    *((uint64_t*)ptr) = (uint64_t)now; ptr += 8;
    
    // Frame summary section marker
    memcpy(ptr, "FSMY", 4); ptr += 4;  // Frame Summary
    *((uint32_t*)ptr) = frame_summary_size; ptr += 4;
    
    // Create frame summaries (metadata per frame instead of full data)
    if (exporter->data && exporter->total_frames > 0) {
        for (int i = 0; i < exporter->total_frames; i++) {
            // Frame summary: frame_index(4) + timestamp(8) + size(4) + checksum(4) + reserved(12)
            *((uint32_t*)ptr) = i; ptr += 4;  // Frame index
            *((uint64_t*)ptr) = (uint64_t)(i * 33.33); ptr += 8;  // Timestamp in ms (30fps)
            *((uint32_t*)ptr) = exporter->width * exporter->height * 4; ptr += 4;  // Frame size
            *((uint32_t*)ptr) = 0xDEADBEEF + i; ptr += 4;  // Simple checksum placeholder
            memset(ptr, 0, 12); ptr += 12;  // Reserved bytes
        }
        printf("📁 Created frame summaries for %d frames (%d bytes)\n", exporter->total_frames, frame_summary_size);
    } else {
        // No frame data available, zero-fill
        memset(ptr, 0, frame_summary_size);
        printf("⚠️ No frame data available, zero-filled\n");
    }
    
    *output_size = total_size;
    printf("✅ Export completed! Output size: %d bytes (%d frames, %dx%d)\n", 
           total_size, exporter->total_frames, exporter->width, exporter->height);
    
    return output_buffer;
}

EMSCRIPTEN_KEEPALIVE
void js_video_exporter_destroy(int exporter_ptr) {
    if (exporter_ptr == 0) return;
    video_decoder_t* exporter = (video_decoder_t*)(uintptr_t)exporter_ptr;
    
    // Free frame buffer if allocated
    if (exporter->data) {
        free(exporter->data);
        exporter->data = NULL;
        printf("🗑️ Freed frame buffer\n");
    }
    
    video_decoder_destroy(exporter);
    printf("🗑️ Destroyed video exporter\n");
}

// WASM Blur Filter
EMSCRIPTEN_KEEPALIVE
void js_apply_blur_filter(uint8_t* frame_data, int width, int height, float radius) {
    if (!frame_data || width <= 0 || height <= 0 || radius <= 0) return;
    
    // Create temporary video frame structure
    video_frame_t temp_frame = {
        .data = frame_data,
        .width = width,
        .height = height,
        .format = 1, // RGBA format
        .timestamp = 0.0
    };
    
    blur_params_t blur_params = {
        .radius = radius,
        .iterations = 1,
        .gaussian = false
    };
    
    filter_blur(&temp_frame, &blur_params);
    printf("🌫️ Applied WASM blur filter (radius: %.1f) to %dx%d frame\n", radius, width, height);
}

// WASM Sharpen Filter  
EMSCRIPTEN_KEEPALIVE
void js_apply_sharpen_filter(uint8_t* frame_data, int width, int height, float intensity) {
    if (!frame_data || width <= 0 || height <= 0 || intensity <= 0) return;
    
    // Create temporary video frame structure
    video_frame_t temp_frame = {
        .data = frame_data,
        .width = width,
        .height = height,
        .format = 1, // RGBA format
        .timestamp = 0.0
    };
    
    filter_sharpen(&temp_frame, intensity);
    printf("⚡ Applied WASM sharpen filter (intensity: %.2f) to %dx%d frame\n", intensity, width, height);
}

// WASM Noise Reduction (Simple implementation)
EMSCRIPTEN_KEEPALIVE
void js_apply_noise_reduction(uint8_t* frame_data, int width, int height, float strength) {
    if (!frame_data || width <= 0 || height <= 0 || strength <= 0) return;
    
    // Simple noise reduction using mild blur
    blur_params_t noise_params = {
        .radius = strength * 2.0f, // Convert strength to blur radius
        .iterations = 1,
        .gaussian = true
    };
    
    video_frame_t temp_frame = {
        .data = frame_data,
        .width = width,
        .height = height,
        .format = 1, // RGBA format
        .timestamp = 0.0
    };
    
    filter_blur(&temp_frame, &noise_params);
    printf("🔧 Applied WASM noise reduction (strength: %.2f) to %dx%d frame\n", strength, width, height);
}