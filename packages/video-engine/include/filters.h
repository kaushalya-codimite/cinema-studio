#ifndef FILTERS_H
#define FILTERS_H

#include "video_engine.h"

// Filter types
typedef enum {
    FILTER_BRIGHTNESS,
    FILTER_CONTRAST,
    FILTER_SATURATION,
    FILTER_HUE,
    FILTER_BLUR,
    FILTER_SHARPEN,
    FILTER_NOISE_REDUCTION,
    FILTER_EDGE_DETECTION
} filter_type_t;

// Filter parameters structure
typedef struct {
    filter_type_t type;
    float intensity;
    float param1;
    float param2;
    float param3;
    bool enabled;
} filter_params_t;

// Color correction parameters
typedef struct {
    float brightness;  // -1.0 to 1.0
    float contrast;    // -1.0 to 1.0
    float saturation;  // -1.0 to 1.0
    float hue;         // -180.0 to 180.0 degrees
    float gamma;       // 0.1 to 3.0
    float exposure;    // -5.0 to 5.0
} color_correction_t;

// Blur parameters
typedef struct {
    float radius;      // 0.0 to 100.0
    int iterations;    // 1 to 10
    bool gaussian;     // true for Gaussian, false for box blur
} blur_params_t;

// Filter functions
EMSCRIPTEN_KEEPALIVE void filter_apply(video_frame_t* frame, filter_params_t* params);
EMSCRIPTEN_KEEPALIVE void filter_color_correction(video_frame_t* frame, color_correction_t* params);
EMSCRIPTEN_KEEPALIVE void filter_blur(video_frame_t* frame, blur_params_t* params);
EMSCRIPTEN_KEEPALIVE void filter_sharpen(video_frame_t* frame, float intensity);
EMSCRIPTEN_KEEPALIVE void filter_edge_detection(video_frame_t* frame, float threshold);
EMSCRIPTEN_KEEPALIVE void filter_noise_reduction(video_frame_t* frame, float strength);

// Real-time filter application
EMSCRIPTEN_KEEPALIVE void apply_real_time_filter(uint8_t* frame_data, int width, int height, 
                                                filter_type_t filter, float intensity);

// GPU-accelerated filters (WebGL integration)
EMSCRIPTEN_KEEPALIVE void filter_gpu_init(void);
EMSCRIPTEN_KEEPALIVE void filter_gpu_apply(video_frame_t* frame, filter_params_t* params);
EMSCRIPTEN_KEEPALIVE void filter_gpu_cleanup(void);

#endif // FILTERS_H