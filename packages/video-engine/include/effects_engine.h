#ifndef EFFECTS_ENGINE_H
#define EFFECTS_ENGINE_H

#include "video_engine.h"
#include "filters.h"
#include "transitions.h"

// Maximum number of effects in a chain
#define MAX_EFFECTS_CHAIN 32

// Effect types
typedef enum {
    EFFECT_TYPE_FILTER,
    EFFECT_TYPE_TRANSITION,
    EFFECT_TYPE_TRANSFORM,
    EFFECT_TYPE_COLOR_CORRECTION
} effect_type_t;

// Effect processing order/priority
typedef enum {
    EFFECT_PRIORITY_COLOR_CORRECTION = 1,  // First: Color corrections
    EFFECT_PRIORITY_FILTER = 2,            // Second: Filters (blur, sharpen, etc.)
    EFFECT_PRIORITY_TRANSFORM = 3,         // Third: Geometric transforms
    EFFECT_PRIORITY_TRANSITION = 4         // Last: Transitions
} effect_priority_t;

// Generic effect structure
typedef struct effect_t {
    effect_type_t type;
    effect_priority_t priority;
    bool enabled;

    union {
        filter_params_t filter;
        color_correction_t color_correction;
        blur_params_t blur;
        transform_params_t transform;
        transition_params_t transition;
    } params;

    // Effect metadata
    double start_time;
    double end_time;
    float intensity_curve[8]; // For keyframe animation
    int keyframe_count;
} effect_t;

// Effect chain structure
typedef struct effect_chain_t {
    effect_t effects[MAX_EFFECTS_CHAIN];
    int count;
    bool sorted;
    memory_pool_t* memory_pool;

    // Processing state
    video_frame_t* temp_frame_1;
    video_frame_t* temp_frame_2;
    bool temp_frames_allocated;
} effect_chain_t;

// Effects engine structure
typedef struct effects_engine_t {
    effect_chain_t* chain;
    memory_pool_t* memory_pool;
    bool initialized;

    // Performance metrics
    double last_process_time_ms;
    int frames_processed;

    // Export state
    bool export_mode;
    video_encoder_t* encoder;
} effects_engine_t;

// Core engine functions
EMSCRIPTEN_KEEPALIVE effects_engine_t* effects_engine_create(void);
EMSCRIPTEN_KEEPALIVE void effects_engine_destroy(effects_engine_t* engine);
EMSCRIPTEN_KEEPALIVE bool effects_engine_init(effects_engine_t* engine);
EMSCRIPTEN_KEEPALIVE void effects_engine_cleanup(effects_engine_t* engine);

// Effect chain management
EMSCRIPTEN_KEEPALIVE effect_chain_t* effect_chain_create(void);
EMSCRIPTEN_KEEPALIVE void effect_chain_destroy(effect_chain_t* chain);
EMSCRIPTEN_KEEPALIVE int effect_chain_add(effect_chain_t* chain, effect_t* effect);
EMSCRIPTEN_KEEPALIVE bool effect_chain_remove(effect_chain_t* chain, int index);
EMSCRIPTEN_KEEPALIVE void effect_chain_clear(effect_chain_t* chain);
EMSCRIPTEN_KEEPALIVE void effect_chain_sort(effect_chain_t* chain);

// Effect processing
EMSCRIPTEN_KEEPALIVE bool effects_process_frame(effects_engine_t* engine, video_frame_t* frame, double timestamp);
EMSCRIPTEN_KEEPALIVE bool effects_process_frame_chain(effect_chain_t* chain, video_frame_t* frame, double timestamp);

// Individual effect builders
EMSCRIPTEN_KEEPALIVE effect_t* effect_create_color_correction(float brightness, float contrast, float saturation, float hue);
EMSCRIPTEN_KEEPALIVE effect_t* effect_create_blur(float radius, bool gaussian);
EMSCRIPTEN_KEEPALIVE effect_t* effect_create_transform(float scale, float rotation, int flip_h, int flip_v);
EMSCRIPTEN_KEEPALIVE effect_t* effect_create_filter(filter_type_t type, float intensity);

// Export functionality
EMSCRIPTEN_KEEPALIVE bool effects_engine_start_export(effects_engine_t* engine, const char* output_path, int width, int height, double fps);
EMSCRIPTEN_KEEPALIVE bool effects_engine_export_frame(effects_engine_t* engine, video_frame_t* frame, double timestamp);
EMSCRIPTEN_KEEPALIVE bool effects_engine_finish_export(effects_engine_t* engine);

// JavaScript bindings
EMSCRIPTEN_KEEPALIVE int js_effects_engine_create(void);
EMSCRIPTEN_KEEPALIVE void js_effects_engine_destroy(int engine_ptr);
EMSCRIPTEN_KEEPALIVE int js_effect_chain_add_color_correction(int engine_ptr, float brightness, float contrast, float saturation, float hue);
EMSCRIPTEN_KEEPALIVE int js_effect_chain_add_blur(int engine_ptr, float radius, int gaussian);
EMSCRIPTEN_KEEPALIVE int js_effect_chain_add_transform(int engine_ptr, float scale, float rotation, int flip_h, int flip_v);
EMSCRIPTEN_KEEPALIVE int js_effects_process_frame(int engine_ptr, uint8_t* frame_data, int width, int height, int format, double timestamp);
EMSCRIPTEN_KEEPALIVE int js_effects_start_export(int engine_ptr, const char* output_path, int width, int height, double fps);
EMSCRIPTEN_KEEPALIVE int js_effects_export_frame(int engine_ptr, uint8_t* frame_data, int width, int height, double timestamp);
EMSCRIPTEN_KEEPALIVE int js_effects_finish_export(int engine_ptr);

// Performance and debugging
EMSCRIPTEN_KEEPALIVE double effects_engine_get_last_process_time(effects_engine_t* engine);
EMSCRIPTEN_KEEPALIVE void effects_engine_get_stats(effects_engine_t* engine, int* frames_processed, double* avg_time);

#endif // EFFECTS_ENGINE_H