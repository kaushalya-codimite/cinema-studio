#include "filters.h"
#include <stdio.h>
#include <math.h>

void filter_black_and_white(video_frame_t* frame, float intensity) {
    if (!frame || !frame->data || intensity < 0.0f) {
        printf("❌ Invalid parameters for black and white filter\n");
        return;
    }
    
    // Clamp intensity to valid range
    if (intensity > 1.0f) intensity = 1.0f;
    
    printf("🔳 Applying black and white filter (intensity: %.2f) to %dx%d frame\n", 
           intensity, frame->width, frame->height);
    
    uint8_t* data = frame->data;
    int total_pixels = frame->width * frame->height;
    
    for (int i = 0; i < total_pixels; i++) {
        int pixel_offset = i * 4; // RGBA format
        
        uint8_t r = data[pixel_offset];
        uint8_t g = data[pixel_offset + 1];
        uint8_t b = data[pixel_offset + 2];
        uint8_t a = data[pixel_offset + 3]; // Preserve alpha
        
        // Convert to float for calculations
        float rf = r / 255.0f;
        float gf = g / 255.0f;
        float bf = b / 255.0f;
        
        // Use luminance formula (ITU-R BT.709 standard for HDTV)
        // This is the standard used in video processing
        float luminance = 0.2126f * rf + 0.7152f * gf + 0.0722f * bf;
        
        // Mix with original based on intensity
        float final_r = rf + (luminance - rf) * intensity;
        float final_g = gf + (luminance - gf) * intensity;
        float final_b = bf + (luminance - bf) * intensity;
        
        // Clamp values to [0,1] and convert back to uint8_t
        final_r = fmaxf(0.0f, fminf(1.0f, final_r));
        final_g = fmaxf(0.0f, fminf(1.0f, final_g));
        final_b = fmaxf(0.0f, fminf(1.0f, final_b));
        
        data[pixel_offset] = (uint8_t)(final_r * 255.0f);
        data[pixel_offset + 1] = (uint8_t)(final_g * 255.0f);
        data[pixel_offset + 2] = (uint8_t)(final_b * 255.0f);
        data[pixel_offset + 3] = a; // Keep original alpha
    }
    
    printf("✅ Black and white filter applied successfully\n");
}