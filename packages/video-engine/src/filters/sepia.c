#include "filters.h"
#include <math.h>

// Apply sepia filter to video frame
void filter_sepia(video_frame_t* frame, float intensity) {
    if (!frame || !frame->data || intensity < 0.0f) return;
    
    int width = frame->width;
    int height = frame->height;
    uint8_t* data = frame->data;
    
    // Process each pixel
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int index = (y * width + x) * 4; // RGBA format
            
            // Get original RGB values
            uint8_t r = data[index];
            uint8_t g = data[index + 1];
            uint8_t b = data[index + 2];
            // Alpha stays the same
            
            // Convert to float for calculations
            float rf = r / 255.0f;
            float gf = g / 255.0f;
            float bf = b / 255.0f;
            
            // Classic sepia tone formula
            float sepia_r = (rf * 0.393f) + (gf * 0.769f) + (bf * 0.189f);
            float sepia_g = (rf * 0.349f) + (gf * 0.686f) + (bf * 0.168f);
            float sepia_b = (rf * 0.272f) + (gf * 0.534f) + (bf * 0.131f);
            
            // Clamp to valid range
            if (sepia_r > 1.0f) sepia_r = 1.0f;
            if (sepia_g > 1.0f) sepia_g = 1.0f;
            if (sepia_b > 1.0f) sepia_b = 1.0f;
            
            // Mix with original based on intensity (0.0 = original, 1.0 = full sepia)
            float final_r = rf + (sepia_r - rf) * intensity;
            float final_g = gf + (sepia_g - gf) * intensity;
            float final_b = bf + (sepia_b - bf) * intensity;
            
            // Convert back to uint8_t
            data[index] = (uint8_t)(final_r * 255.0f + 0.5f);
            data[index + 1] = (uint8_t)(final_g * 255.0f + 0.5f);
            data[index + 2] = (uint8_t)(final_b * 255.0f + 0.5f);
            // data[index + 3] (alpha) remains unchanged
        }
    }
}