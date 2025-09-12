#include "filters.h"
#include <stdio.h>
#include <math.h>

void filter_vintage(video_frame_t* frame, float intensity) {
    if (!frame || !frame->data || intensity < 0.0f) {
        printf("❌ Invalid parameters for vintage filter\n");
        return;
    }
    
    // Clamp intensity to valid range
    if (intensity > 1.0f) intensity = 1.0f;
    
    printf("🎞️ Applying vintage filter (intensity: %.2f) to %dx%d frame\n", 
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
        
        // Vintage effect combines several techniques:
        // 1. Slight sepia tone
        // 2. Reduced saturation
        // 3. Soft contrast adjustment
        // 4. Warm color temperature shift
        
        // Apply sepia-like transformation but less intense
        float vintage_r = rf * 0.9f + gf * 0.5f + bf * 0.3f;
        float vintage_g = rf * 0.3f + gf * 0.8f + bf * 0.3f;
        float vintage_b = rf * 0.2f + gf * 0.3f + bf * 0.7f;
        
        // Reduce contrast slightly for soft look
        vintage_r = 0.3f + vintage_r * 0.7f;
        vintage_g = 0.3f + vintage_g * 0.7f;
        vintage_b = 0.3f + vintage_b * 0.7f;
        
        // Clamp to valid range
        vintage_r = fmaxf(0.0f, fminf(1.0f, vintage_r));
        vintage_g = fmaxf(0.0f, fminf(1.0f, vintage_g));
        vintage_b = fmaxf(0.0f, fminf(1.0f, vintage_b));
        
        // Mix with original based on intensity
        float final_r = rf + (vintage_r - rf) * intensity;
        float final_g = gf + (vintage_g - gf) * intensity;
        float final_b = bf + (vintage_b - bf) * intensity;
        
        // Clamp final values
        final_r = fmaxf(0.0f, fminf(1.0f, final_r));
        final_g = fmaxf(0.0f, fminf(1.0f, final_g));
        final_b = fmaxf(0.0f, fminf(1.0f, final_b));
        
        data[pixel_offset] = (uint8_t)(final_r * 255.0f);
        data[pixel_offset + 1] = (uint8_t)(final_g * 255.0f);
        data[pixel_offset + 2] = (uint8_t)(final_b * 255.0f);
        data[pixel_offset + 3] = a; // Keep original alpha
    }
    
    printf("✅ Vintage filter applied successfully\n");
}