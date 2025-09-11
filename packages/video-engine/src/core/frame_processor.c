#include "video_engine.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>

// Bilinear interpolation for pixel scaling
static uint32_t interpolate_pixel(uint8_t* data, int width, int height, float x, float y) {
    int x1 = (int)floor(x);
    int y1 = (int)floor(y);
    int x2 = x1 + 1;
    int y2 = y1 + 1;
    
    // Clamp coordinates
    x1 = x1 < 0 ? 0 : (x1 >= width ? width - 1 : x1);
    y1 = y1 < 0 ? 0 : (y1 >= height ? height - 1 : y1);
    x2 = x2 < 0 ? 0 : (x2 >= width ? width - 1 : x2);
    y2 = y2 < 0 ? 0 : (y2 >= height ? height - 1 : y2);
    
    float fx = x - x1;
    float fy = y - y1;
    
    // Get pixel values (assuming RGBA format)
    uint32_t* pixels = (uint32_t*)data;
    uint32_t p11 = pixels[y1 * width + x1];
    uint32_t p12 = pixels[y1 * width + x2];
    uint32_t p21 = pixels[y2 * width + x1];
    uint32_t p22 = pixels[y2 * width + x2];
    
    // Extract components
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
    
    // Interpolate
    uint8_t r = (uint8_t)(r11 * (1-fx) * (1-fy) + r12 * fx * (1-fy) + r21 * (1-fx) * fy + r22 * fx * fy);
    uint8_t g = (uint8_t)(g11 * (1-fx) * (1-fy) + g12 * fx * (1-fy) + g21 * (1-fx) * fy + g22 * fx * fy);
    uint8_t b = (uint8_t)(b11 * (1-fx) * (1-fy) + b12 * fx * (1-fy) + b21 * (1-fx) * fy + b22 * fx * fy);
    uint8_t a = (uint8_t)(a11 * (1-fx) * (1-fy) + a12 * fx * (1-fy) + a21 * (1-fx) * fy + a22 * fx * fy);
    
    return r | (g << 8) | (b << 16) | (a << 24);
}

void video_frame_resize(video_frame_t* src, video_frame_t* dst, int new_width, int new_height) {
    if (!src || !dst || !src->data || new_width <= 0 || new_height <= 0) return;
    
    // Allocate destination data if needed
    if (!dst->data) {
        dst->data = (uint8_t*)malloc(new_width * new_height * 4); // RGBA
        if (!dst->data) return;
    }
    
    dst->width = new_width;
    dst->height = new_height;
    dst->stride = new_width * 4;
    dst->format = src->format;
    dst->timestamp = src->timestamp;
    dst->frame_number = src->frame_number;
    
    // Scale factors
    float x_scale = (float)src->width / new_width;
    float y_scale = (float)src->height / new_height;
    
    uint32_t* dst_pixels = (uint32_t*)dst->data;
    
    for (int y = 0; y < new_height; y++) {
        for (int x = 0; x < new_width; x++) {
            float src_x = x * x_scale;
            float src_y = y * y_scale;
            
            uint32_t pixel = interpolate_pixel(src->data, src->width, src->height, src_x, src_y);
            dst_pixels[y * new_width + x] = pixel;
        }
    }
}

void video_frame_crop(video_frame_t* src, video_frame_t* dst, int x, int y, int width, int height) {
    if (!src || !dst || !src->data || x < 0 || y < 0 || 
        x + width > src->width || y + height > src->height) return;
    
    // Allocate destination data if needed
    if (!dst->data) {
        dst->data = (uint8_t*)malloc(width * height * 4); // RGBA
        if (!dst->data) return;
    }
    
    dst->width = width;
    dst->height = height;
    dst->stride = width * 4;
    dst->format = src->format;
    dst->timestamp = src->timestamp;
    dst->frame_number = src->frame_number;
    
    uint32_t* src_pixels = (uint32_t*)src->data;
    uint32_t* dst_pixels = (uint32_t*)dst->data;
    
    for (int row = 0; row < height; row++) {
        int src_row = y + row;
        for (int col = 0; col < width; col++) {
            int src_col = x + col;
            dst_pixels[row * width + col] = src_pixels[src_row * src->width + src_col];
        }
    }
}

void video_frame_convert_rgb_to_rgba(video_frame_t* src, video_frame_t* dst) {
    if (!src || !dst || !src->data || src->format != 0) return; // Source must be RGB
    
    int pixel_count = src->width * src->height;
    
    // Allocate destination data if needed
    if (!dst->data) {
        dst->data = (uint8_t*)malloc(pixel_count * 4); // RGBA
        if (!dst->data) return;
    }
    
    dst->width = src->width;
    dst->height = src->height;
    dst->stride = src->width * 4;
    dst->format = 1; // RGBA
    dst->timestamp = src->timestamp;
    dst->frame_number = src->frame_number;
    
    uint8_t* src_data = src->data;
    uint8_t* dst_data = dst->data;
    
    for (int i = 0; i < pixel_count; i++) {
        dst_data[i * 4 + 0] = src_data[i * 3 + 0]; // R
        dst_data[i * 4 + 1] = src_data[i * 3 + 1]; // G
        dst_data[i * 4 + 2] = src_data[i * 3 + 2]; // B
        dst_data[i * 4 + 3] = 255;                 // A (full opacity)
    }
}