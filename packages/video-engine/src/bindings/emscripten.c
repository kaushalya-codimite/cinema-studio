#include "video_engine.h"
#include "filters.h"
#include <string.h>

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

// Blur and sharpen filters
EMSCRIPTEN_KEEPALIVE
void js_apply_blur_filter(int frame_ptr, float radius) {
    if (frame_ptr == 0) return;
    video_frame_t* frame = (video_frame_t*)(uintptr_t)frame_ptr;
    
    blur_params_t params = {
        .radius = radius,
        .iterations = 1,
        .gaussian = false
    };
    
    filter_blur(frame, &params);
}

EMSCRIPTEN_KEEPALIVE
void js_apply_sharpen_filter(int frame_ptr, float intensity) {
    if (frame_ptr == 0) return;
    video_frame_t* frame = (video_frame_t*)(uintptr_t)frame_ptr;
    filter_sharpen(frame, intensity);
}

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