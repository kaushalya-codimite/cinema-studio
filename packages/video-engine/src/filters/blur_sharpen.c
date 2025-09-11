#include "filters.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

// Simple box blur implementation
void filter_blur(video_frame_t* frame, blur_params_t* params) {
    if (!frame || !frame->data || !params || frame->format != 1) return; // RGBA only
    
    int width = frame->width;
    int height = frame->height;
    int radius = (int)params->radius;
    
    if (radius <= 0) return;
    
    // Allocate temporary buffer
    uint8_t* temp_data = (uint8_t*)malloc(width * height * 4);
    if (!temp_data) return;
    
    memcpy(temp_data, frame->data, width * height * 4);
    
    // Horizontal blur pass
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int sum_r = 0, sum_g = 0, sum_b = 0, sum_a = 0;
            int count = 0;
            
            for (int dx = -radius; dx <= radius; dx++) {
                int nx = x + dx;
                if (nx >= 0 && nx < width) {
                    int idx = (y * width + nx) * 4;
                    sum_r += temp_data[idx + 0];
                    sum_g += temp_data[idx + 1];
                    sum_b += temp_data[idx + 2];
                    sum_a += temp_data[idx + 3];
                    count++;
                }
            }
            
            int idx = (y * width + x) * 4;
            frame->data[idx + 0] = sum_r / count;
            frame->data[idx + 1] = sum_g / count;
            frame->data[idx + 2] = sum_b / count;
            frame->data[idx + 3] = sum_a / count;
        }
    }
    
    // Vertical blur pass
    memcpy(temp_data, frame->data, width * height * 4);
    
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int sum_r = 0, sum_g = 0, sum_b = 0, sum_a = 0;
            int count = 0;
            
            for (int dy = -radius; dy <= radius; dy++) {
                int ny = y + dy;
                if (ny >= 0 && ny < height) {
                    int idx = (ny * width + x) * 4;
                    sum_r += temp_data[idx + 0];
                    sum_g += temp_data[idx + 1];
                    sum_b += temp_data[idx + 2];
                    sum_a += temp_data[idx + 3];
                    count++;
                }
            }
            
            int idx = (y * width + x) * 4;
            frame->data[idx + 0] = sum_r / count;
            frame->data[idx + 1] = sum_g / count;
            frame->data[idx + 2] = sum_b / count;
            frame->data[idx + 3] = sum_a / count;
        }
    }
    
    free(temp_data);
}

void filter_sharpen(video_frame_t* frame, float intensity) {
    if (!frame || !frame->data || frame->format != 1) return; // RGBA only
    
    int width = frame->width;
    int height = frame->height;
    
    // Allocate temporary buffer
    uint8_t* temp_data = (uint8_t*)malloc(width * height * 4);
    if (!temp_data) return;
    
    memcpy(temp_data, frame->data, width * height * 4);
    
    // Apply sharpening kernel
    float kernel[9] = {
        0, -intensity, 0,
        -intensity, 1 + 4 * intensity, -intensity,
        0, -intensity, 0
    };
    
    for (int y = 1; y < height - 1; y++) {
        for (int x = 1; x < width - 1; x++) {
            float sum_r = 0, sum_g = 0, sum_b = 0;
            
            for (int ky = -1; ky <= 1; ky++) {
                for (int kx = -1; kx <= 1; kx++) {
                    int idx = ((y + ky) * width + (x + kx)) * 4;
                    float weight = kernel[(ky + 1) * 3 + (kx + 1)];
                    
                    sum_r += temp_data[idx + 0] * weight;
                    sum_g += temp_data[idx + 1] * weight;
                    sum_b += temp_data[idx + 2] * weight;
                }
            }
            
            int idx = (y * width + x) * 4;
            frame->data[idx + 0] = (uint8_t)fmaxf(0.0f, fminf(255.0f, sum_r));
            frame->data[idx + 1] = (uint8_t)fmaxf(0.0f, fminf(255.0f, sum_g));
            frame->data[idx + 2] = (uint8_t)fmaxf(0.0f, fminf(255.0f, sum_b));
        }
    }
    
    free(temp_data);
}