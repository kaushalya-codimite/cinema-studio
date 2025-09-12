#include "filters.h"
#include <stdio.h>
#include <math.h>
#include <stdlib.h>

void filter_edge_detection_new(video_frame_t* frame, float intensity) {
    if (!frame || !frame->data || intensity < 0.0f) {
        printf("❌ Invalid parameters for edge detection filter\n");
        return;
    }
    
    // Clamp intensity to valid range
    if (intensity > 1.0f) intensity = 1.0f;
    
    printf("🔍 Applying edge detection filter (intensity: %.2f) to %dx%d frame\n", 
           intensity, frame->width, frame->height);
    
    uint8_t* data = frame->data;
    int width = frame->width;
    int height = frame->height;
    
    // Create temporary buffer for processed image
    uint8_t* temp_data = (uint8_t*)malloc(width * height * 4);
    if (!temp_data) {
        printf("❌ Failed to allocate memory for edge detection\n");
        return;
    }
    
    // Copy original data to temp buffer
    for (int i = 0; i < width * height * 4; i++) {
        temp_data[i] = data[i];
    }
    
    // Sobel edge detection kernels
    int sobel_x[3][3] = {
        {-1, 0, 1},
        {-2, 0, 2},
        {-1, 0, 1}
    };
    
    int sobel_y[3][3] = {
        {-1, -2, -1},
        { 0,  0,  0},
        { 1,  2,  1}
    };
    
    for (int y = 1; y < height - 1; y++) {
        for (int x = 1; x < width - 1; x++) {
            int pixel_offset = (y * width + x) * 4;
            
            float gx_r = 0, gx_g = 0, gx_b = 0;
            float gy_r = 0, gy_g = 0, gy_b = 0;
            
            // Apply Sobel kernels
            for (int ky = -1; ky <= 1; ky++) {
                for (int kx = -1; kx <= 1; kx++) {
                    int sample_x = x + kx;
                    int sample_y = y + ky;
                    int sample_offset = (sample_y * width + sample_x) * 4;
                    
                    float r = temp_data[sample_offset] / 255.0f;
                    float g = temp_data[sample_offset + 1] / 255.0f;
                    float b = temp_data[sample_offset + 2] / 255.0f;
                    
                    int kernel_x = sobel_x[ky + 1][kx + 1];
                    int kernel_y = sobel_y[ky + 1][kx + 1];
                    
                    gx_r += r * kernel_x;
                    gx_g += g * kernel_x;
                    gx_b += b * kernel_x;
                    
                    gy_r += r * kernel_y;
                    gy_g += g * kernel_y;
                    gy_b += b * kernel_y;
                }
            }
            
            // Calculate gradient magnitude
            float magnitude_r = sqrtf(gx_r * gx_r + gy_r * gy_r);
            float magnitude_g = sqrtf(gx_g * gx_g + gy_g * gy_g);
            float magnitude_b = sqrtf(gx_b * gx_b + gy_b * gy_b);
            
            // Use average magnitude for edge strength
            float edge_strength = (magnitude_r + magnitude_g + magnitude_b) / 3.0f;
            
            // Clamp edge strength
            edge_strength = fmaxf(0.0f, fminf(1.0f, edge_strength * 3.0f)); // Amplify edges
            
            // Get original pixel values
            float orig_r = temp_data[pixel_offset] / 255.0f;
            float orig_g = temp_data[pixel_offset + 1] / 255.0f;
            float orig_b = temp_data[pixel_offset + 2] / 255.0f;
            
            // Mix edge detection with original image based on intensity
            float final_r = orig_r + (edge_strength - orig_r) * intensity;
            float final_g = orig_g + (edge_strength - orig_g) * intensity;
            float final_b = orig_b + (edge_strength - orig_b) * intensity;
            
            // Clamp final values
            final_r = fmaxf(0.0f, fminf(1.0f, final_r));
            final_g = fmaxf(0.0f, fminf(1.0f, final_g));
            final_b = fmaxf(0.0f, fminf(1.0f, final_b));
            
            data[pixel_offset] = (uint8_t)(final_r * 255.0f);
            data[pixel_offset + 1] = (uint8_t)(final_g * 255.0f);
            data[pixel_offset + 2] = (uint8_t)(final_b * 255.0f);
            // Alpha channel remains unchanged
        }
    }
    
    free(temp_data);
    printf("✅ Edge detection filter applied successfully\n");
}