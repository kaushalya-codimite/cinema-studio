#include "video_engine.h"
#include <math.h>

// YUV to RGB conversion coefficients (ITU-R BT.709)
static const float YUV_TO_RGB_MATRIX[9] = {
    1.0f,  0.0f,      1.5748f,     // Y, U, V -> R
    1.0f, -0.1873f,  -0.4681f,     // Y, U, V -> G
    1.0f,  1.8556f,   0.0f         // Y, U, V -> B
};

// RGB to YUV conversion coefficients (ITU-R BT.709)
static const float RGB_TO_YUV_MATRIX[9] = {
    0.2126f,  0.7152f,  0.0722f,   // R, G, B -> Y
   -0.1146f, -0.3854f,  0.5f,      // R, G, B -> U
    0.5f,    -0.4542f, -0.0458f    // R, G, B -> V
};

// Clamp value between 0 and 255
static inline uint8_t clamp_uint8(float value) {
    if (value < 0.0f) return 0;
    if (value > 255.0f) return 255;
    return (uint8_t)value;
}

EMSCRIPTEN_KEEPALIVE
void convert_rgb_to_yuv420(uint8_t* rgb_data, uint8_t* yuv_data, int width, int height) {
    if (!rgb_data || !yuv_data || width <= 0 || height <= 0) return;
    
    int y_size = width * height;
    int uv_size = (width / 2) * (height / 2);
    
    uint8_t* y_plane = yuv_data;
    uint8_t* u_plane = yuv_data + y_size;
    uint8_t* v_plane = yuv_data + y_size + uv_size;
    
    // Convert RGB to YUV
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int rgb_idx = (y * width + x) * 3;
            int y_idx = y * width + x;
            
            uint8_t r = rgb_data[rgb_idx + 0];
            uint8_t g = rgb_data[rgb_idx + 1];
            uint8_t b = rgb_data[rgb_idx + 2];
            
            // Calculate Y component
            float y_val = RGB_TO_YUV_MATRIX[0] * r + RGB_TO_YUV_MATRIX[1] * g + RGB_TO_YUV_MATRIX[2] * b;
            y_plane[y_idx] = clamp_uint8(y_val);
            
            // Calculate U and V components (subsampled 4:2:0)
            if ((y % 2 == 0) && (x % 2 == 0)) {
                int uv_idx = (y / 2) * (width / 2) + (x / 2);
                
                float u_val = RGB_TO_YUV_MATRIX[3] * r + RGB_TO_YUV_MATRIX[4] * g + RGB_TO_YUV_MATRIX[5] * b + 128.0f;
                float v_val = RGB_TO_YUV_MATRIX[6] * r + RGB_TO_YUV_MATRIX[7] * g + RGB_TO_YUV_MATRIX[8] * b + 128.0f;
                
                u_plane[uv_idx] = clamp_uint8(u_val);
                v_plane[uv_idx] = clamp_uint8(v_val);
            }
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void convert_yuv420_to_rgb(uint8_t* yuv_data, uint8_t* rgb_data, int width, int height) {
    if (!yuv_data || !rgb_data || width <= 0 || height <= 0) return;
    
    int y_size = width * height;
    int uv_size = (width / 2) * (height / 2);
    
    uint8_t* y_plane = yuv_data;
    uint8_t* u_plane = yuv_data + y_size;
    uint8_t* v_plane = yuv_data + y_size + uv_size;
    
    // Convert YUV to RGB
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int y_idx = y * width + x;
            int uv_idx = (y / 2) * (width / 2) + (x / 2);
            int rgb_idx = (y * width + x) * 3;
            
            float y_val = (float)y_plane[y_idx];
            float u_val = (float)u_plane[uv_idx] - 128.0f;
            float v_val = (float)v_plane[uv_idx] - 128.0f;
            
            // Calculate RGB components
            float r_val = YUV_TO_RGB_MATRIX[0] * y_val + YUV_TO_RGB_MATRIX[1] * u_val + YUV_TO_RGB_MATRIX[2] * v_val;
            float g_val = YUV_TO_RGB_MATRIX[3] * y_val + YUV_TO_RGB_MATRIX[4] * u_val + YUV_TO_RGB_MATRIX[5] * v_val;
            float b_val = YUV_TO_RGB_MATRIX[6] * y_val + YUV_TO_RGB_MATRIX[7] * u_val + YUV_TO_RGB_MATRIX[8] * v_val;
            
            rgb_data[rgb_idx + 0] = clamp_uint8(r_val);
            rgb_data[rgb_idx + 1] = clamp_uint8(g_val);
            rgb_data[rgb_idx + 2] = clamp_uint8(b_val);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void convert_rgba_to_rgb(uint8_t* rgba_data, uint8_t* rgb_data, int width, int height) {
    if (!rgba_data || !rgb_data || width <= 0 || height <= 0) return;
    
    int pixel_count = width * height;
    
    for (int i = 0; i < pixel_count; i++) {
        rgb_data[i * 3 + 0] = rgba_data[i * 4 + 0]; // R
        rgb_data[i * 3 + 1] = rgba_data[i * 4 + 1]; // G
        rgb_data[i * 3 + 2] = rgba_data[i * 4 + 2]; // B
        // Skip alpha channel
    }
}

EMSCRIPTEN_KEEPALIVE
void convert_rgb_to_rgba(uint8_t* rgb_data, uint8_t* rgba_data, int width, int height, uint8_t alpha) {
    if (!rgb_data || !rgba_data || width <= 0 || height <= 0) return;
    
    int pixel_count = width * height;
    
    for (int i = 0; i < pixel_count; i++) {
        rgba_data[i * 4 + 0] = rgb_data[i * 3 + 0]; // R
        rgba_data[i * 4 + 1] = rgb_data[i * 3 + 1]; // G
        rgba_data[i * 4 + 2] = rgb_data[i * 3 + 2]; // B
        rgba_data[i * 4 + 3] = alpha;                // A
    }
}