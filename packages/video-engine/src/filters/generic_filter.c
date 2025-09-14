#include "../include/filters.h"
#include "../include/video_engine.h"
#include <string.h>
#include <stdlib.h>

// Generic filter application function
EMSCRIPTEN_KEEPALIVE
void filter_apply(video_frame_t* frame, filter_params_t* params) {
    if (!frame || !params || !params->enabled) {
        return;
    }

    switch (params->type) {
        case FILTER_BRIGHTNESS:
            // Apply brightness using color correction
            {
                color_correction_t color_params = {0};
                color_params.brightness = params->intensity;
                color_params.contrast = 0.0f;
                color_params.saturation = 0.0f;
                color_params.hue = 0.0f;
                color_params.gamma = 1.0f;
                color_params.exposure = 0.0f;
                filter_color_correction(frame, &color_params);
            }
            break;

        case FILTER_CONTRAST:
            // Apply contrast using color correction
            {
                color_correction_t color_params = {0};
                color_params.brightness = 0.0f;
                color_params.contrast = params->intensity;
                color_params.saturation = 0.0f;
                color_params.hue = 0.0f;
                color_params.gamma = 1.0f;
                color_params.exposure = 0.0f;
                filter_color_correction(frame, &color_params);
            }
            break;

        case FILTER_SATURATION:
            // Apply saturation using color correction
            {
                color_correction_t color_params = {0};
                color_params.brightness = 0.0f;
                color_params.contrast = 0.0f;
                color_params.saturation = params->intensity;
                color_params.hue = 0.0f;
                color_params.gamma = 1.0f;
                color_params.exposure = 0.0f;
                filter_color_correction(frame, &color_params);
            }
            break;

        case FILTER_HUE:
            // Apply hue using color correction
            {
                color_correction_t color_params = {0};
                color_params.brightness = 0.0f;
                color_params.contrast = 0.0f;
                color_params.saturation = 0.0f;
                color_params.hue = params->intensity * 180.0f; // Convert to degrees
                color_params.gamma = 1.0f;
                color_params.exposure = 0.0f;
                filter_color_correction(frame, &color_params);
            }
            break;

        case FILTER_BLUR:
            // Apply blur
            {
                blur_params_t blur_params;
                blur_params.radius = params->intensity * 20.0f; // Scale intensity to radius
                blur_params.gaussian = true;
                blur_params.iterations = 1;
                filter_blur(frame, &blur_params);
            }
            break;

        case FILTER_SHARPEN:
            filter_sharpen(frame, params->intensity);
            break;

        case FILTER_EDGE_DETECTION:
            filter_edge_detection_new(frame, params->intensity);
            break;

        case FILTER_NOISE_REDUCTION:
            filter_noise_reduction(frame, params->intensity);
            break;

        default:
            // Unknown filter type, do nothing
            break;
    }
}

// Simple noise reduction implementation
EMSCRIPTEN_KEEPALIVE
void filter_noise_reduction(video_frame_t* frame, float strength) {
    if (!frame || !frame->data || strength <= 0.0f) return;

    int width = frame->width;
    int height = frame->height;
    uint8_t* data = frame->data;
    int channels = (frame->format == 1) ? 4 : 3; // RGBA or RGB

    // Simple averaging filter for noise reduction
    // Apply a 3x3 weighted average with the center pixel having more weight
    float center_weight = 1.0f - (strength * 0.3f);
    float neighbor_weight = strength * 0.05f;

    // Create temporary buffer
    uint8_t* temp_data = malloc(width * height * channels);
    if (!temp_data) return;

    memcpy(temp_data, data, width * height * channels);

    for (int y = 1; y < height - 1; y++) {
        for (int x = 1; x < width - 1; x++) {
            for (int c = 0; c < channels; c++) {
                int idx = (y * width + x) * channels + c;

                // Skip alpha channel if RGBA
                if (channels == 4 && c == 3) {
                    continue;
                }

                float sum = 0.0f;
                sum += temp_data[idx] * center_weight; // center pixel

                // 8 neighbors
                sum += temp_data[((y-1) * width + (x-1)) * channels + c] * neighbor_weight;
                sum += temp_data[((y-1) * width + x) * channels + c] * neighbor_weight;
                sum += temp_data[((y-1) * width + (x+1)) * channels + c] * neighbor_weight;
                sum += temp_data[(y * width + (x-1)) * channels + c] * neighbor_weight;
                sum += temp_data[(y * width + (x+1)) * channels + c] * neighbor_weight;
                sum += temp_data[((y+1) * width + (x-1)) * channels + c] * neighbor_weight;
                sum += temp_data[((y+1) * width + x) * channels + c] * neighbor_weight;
                sum += temp_data[((y+1) * width + (x+1)) * channels + c] * neighbor_weight;

                data[idx] = (uint8_t)(sum + 0.5f);
            }
        }
    }

    free(temp_data);
}