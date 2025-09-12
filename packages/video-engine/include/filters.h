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

// Transform parameters
typedef struct {
    float scale;           // Scale factor (100 = 100%, 200 = 200%, etc.)
    float rotation;        // Rotation angle in degrees
    int flip_horizontal;   // 1 = flip horizontally, 0 = don't flip
    int flip_vertical;     // 1 = flip vertically, 0 = don't flip
    int crop_x;           // Crop X position (percentage)
    int crop_y;           // Crop Y position (percentage) 
    int crop_width;       // Crop width (percentage)
    int crop_height;      // Crop height (percentage)
} transform_params_t;

// Filter functions
EMSCRIPTEN_KEEPALIVE void filter_apply(video_frame_t* frame, filter_params_t* params);
EMSCRIPTEN_KEEPALIVE void filter_color_correction(video_frame_t* frame, color_correction_t* params);
EMSCRIPTEN_KEEPALIVE void filter_blur(video_frame_t* frame, blur_params_t* params);
EMSCRIPTEN_KEEPALIVE void filter_sharpen(video_frame_t* frame, float intensity);
EMSCRIPTEN_KEEPALIVE void filter_edge_detection(video_frame_t* frame, float threshold);
EMSCRIPTEN_KEEPALIVE void filter_noise_reduction(video_frame_t* frame, float strength);
EMSCRIPTEN_KEEPALIVE void filter_transform(video_frame_t* frame, transform_params_t* params);
EMSCRIPTEN_KEEPALIVE void filter_sepia(video_frame_t* frame, float intensity);
EMSCRIPTEN_KEEPALIVE void filter_black_and_white(video_frame_t* frame, float intensity);
EMSCRIPTEN_KEEPALIVE void filter_vintage(video_frame_t* frame, float intensity);
EMSCRIPTEN_KEEPALIVE void filter_vignette(video_frame_t* frame, float intensity);
EMSCRIPTEN_KEEPALIVE void filter_edge_detection_new(video_frame_t* frame, float intensity);

// Real-time filter application
EMSCRIPTEN_KEEPALIVE void apply_real_time_filter(uint8_t* frame_data, int width, int height, 
                                                filter_type_t filter, float intensity);

// GPU-accelerated filters (WebGL integration)
EMSCRIPTEN_KEEPALIVE void filter_gpu_init(void);
EMSCRIPTEN_KEEPALIVE void filter_gpu_apply(video_frame_t* frame, filter_params_t* params);
EMSCRIPTEN_KEEPALIVE void filter_gpu_cleanup(void);

#endif // FILTERS_H