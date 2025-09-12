#include "filters.h"
#include <math.h>
#include <string.h>

// Helper function to perform bilinear sampling
static inline uint32_t sample_pixel(uint8_t* data, int width, int height, float x, float y) {
    // Clamp coordinates to image bounds
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= width - 1) x = width - 1;
    if (y >= height - 1) y = height - 1;
    
    int x1 = (int)x;
    int y1 = (int)y;
    int x2 = x1 + 1;
    int y2 = y1 + 1;
    
    if (x2 >= width) x2 = width - 1;
    if (y2 >= height) y2 = height - 1;
    
    float fx = x - x1;
    float fy = y - y1;
    
    // Get four neighboring pixels
    uint32_t* pixels = (uint32_t*)data;
    uint32_t p11 = pixels[y1 * width + x1];
    uint32_t p12 = pixels[y1 * width + x2];
    uint32_t p21 = pixels[y2 * width + x1];
    uint32_t p22 = pixels[y2 * width + x2];
    
    // Extract RGBA components
    uint8_t r11 = p11 & 0xFF;
    uint8_t g11 = (p11 >> 8) & 0xFF;
    uint8_t b11 = (p11 >> 16) & 0xFF;
    uint8_t a11 = (p11 >> 24) & 0xFF;
    
    uint8_t r12 = p12 & 0xFF;
    uint8_t g12 = (p12 >> 8) & 0xFF;
    uint8_t b12 = (p12 >> 16) & 0xFF;
    uint8_t a12 = (p12 >> 24) & 0xFF;
    
    uint8_t r21 = p21 & 0xFF;
    uint8_t g21 = (p21 >> 8) & 0xFF;
    uint8_t b21 = (p21 >> 16) & 0xFF;
    uint8_t a21 = (p21 >> 24) & 0xFF;
    
    uint8_t r22 = p22 & 0xFF;
    uint8_t g22 = (p22 >> 8) & 0xFF;
    uint8_t b22 = (p22 >> 16) & 0xFF;
    uint8_t a22 = (p22 >> 24) & 0xFF;
    
    // Bilinear interpolation
    float r = r11 * (1 - fx) * (1 - fy) + r12 * fx * (1 - fy) + r21 * (1 - fx) * fy + r22 * fx * fy;
    float g = g11 * (1 - fx) * (1 - fy) + g12 * fx * (1 - fy) + g21 * (1 - fx) * fy + g22 * fx * fy;
    float b = b11 * (1 - fx) * (1 - fy) + b12 * fx * (1 - fy) + b21 * (1 - fx) * fy + b22 * fx * fy;
    float a = a11 * (1 - fx) * (1 - fy) + a12 * fx * (1 - fy) + a21 * (1 - fx) * fy + a22 * fx * fy;
    
    return ((uint32_t)(a + 0.5f) << 24) | ((uint32_t)(b + 0.5f) << 16) | ((uint32_t)(g + 0.5f) << 8) | (uint32_t)(r + 0.5f);
}

// Apply transform effects to video frame
void filter_transform(video_frame_t* frame, transform_params_t* params) {
    if (!frame || !frame->data || !params) return;
    
    int width = frame->width;
    int height = frame->height;
    
    // Allocate temporary buffer for transformation
    uint8_t* temp_data = (uint8_t*)malloc(width * height * 4);
    if (!temp_data) return;
    
    memcpy(temp_data, frame->data, width * height * 4);
    
    // Clear the output buffer
    memset(frame->data, 0, width * height * 4);
    
    // Convert parameters
    float scale_factor = params->scale / 100.0f;
    float rotation_rad = params->rotation * M_PI / 180.0f;
    
    // Calculate crop boundaries
    int crop_left = (params->crop_x * width) / 100;
    int crop_top = (params->crop_y * height) / 100;
    int crop_right = crop_left + (params->crop_width * width) / 100;
    int crop_bottom = crop_top + (params->crop_height * height) / 100;
    
    // Clamp crop boundaries
    if (crop_left < 0) crop_left = 0;
    if (crop_top < 0) crop_top = 0;
    if (crop_right > width) crop_right = width;
    if (crop_bottom > height) crop_bottom = height;
    
    // Pre-calculate rotation matrix
    float cos_theta = cosf(rotation_rad);
    float sin_theta = sinf(rotation_rad);
    
    // Center coordinates
    float center_x = width * 0.5f;
    float center_y = height * 0.5f;
    
    uint32_t* output_pixels = (uint32_t*)frame->data;
    
    // Apply transformation for each pixel
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            // Apply cropping
            if (x < crop_left || x >= crop_right || y < crop_top || y >= crop_bottom) {
                // Outside crop area - set to transparent/black
                output_pixels[y * width + x] = 0x00000000;
                continue;
            }
            
            // Transform coordinates relative to center
            float tx = (x - center_x) / scale_factor;
            float ty = (y - center_y) / scale_factor;
            
            // Apply rotation
            float rx = tx * cos_theta - ty * sin_theta;
            float ry = tx * sin_theta + ty * cos_theta;
            
            // Translate back and apply flipping
            float source_x = rx + center_x;
            float source_y = ry + center_y;
            
            if (params->flip_horizontal) {
                source_x = width - 1 - source_x;
            }
            
            if (params->flip_vertical) {
                source_y = height - 1 - source_y;
            }
            
            // Sample from source image with bilinear interpolation
            if (source_x >= 0 && source_x < width && source_y >= 0 && source_y < height) {
                output_pixels[y * width + x] = sample_pixel(temp_data, width, height, source_x, source_y);
            } else {
                // Outside source bounds - set to transparent/black
                output_pixels[y * width + x] = 0x00000000;
            }
        }
    }
    
    free(temp_data);
}