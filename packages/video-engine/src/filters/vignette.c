#include "filters.h"
#include <stdio.h>
#include <math.h>

void filter_vignette(video_frame_t* frame, float intensity) {
    if (!frame || !frame->data || intensity < 0.0f) {
        printf("❌ Invalid parameters for vignette filter\n");
        return;
    }
    
    // Clamp intensity to valid range
    if (intensity > 1.0f) intensity = 1.0f;
    
    printf("⚫ Applying vignette filter (intensity: %.2f) to %dx%d frame\n", 
           intensity, frame->width, frame->height);
    
    uint8_t* data = frame->data;
    int width = frame->width;
    int height = frame->height;
    
    // Calculate center and maximum distance for vignette
    float center_x = width * 0.5f;
    float center_y = height * 0.5f;
    float max_distance = sqrtf(center_x * center_x + center_y * center_y);
    
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int pixel_offset = (y * width + x) * 4; // RGBA format
            
            uint8_t r = data[pixel_offset];
            uint8_t g = data[pixel_offset + 1];
            uint8_t b = data[pixel_offset + 2];
            uint8_t a = data[pixel_offset + 3]; // Preserve alpha
            
            // Calculate distance from center
            float dx = x - center_x;
            float dy = y - center_y;
            float distance = sqrtf(dx * dx + dy * dy);
            
            // Calculate vignette factor (0 = black, 1 = no effect)
            float distance_ratio = distance / max_distance;
            
            // Create smooth falloff - adjust the power for different vignette curves
            float vignette_factor = 1.0f - powf(distance_ratio, 1.5f);
            
            // Ensure vignette factor is in valid range
            vignette_factor = fmaxf(0.0f, fminf(1.0f, vignette_factor));
            
            // Apply vignette effect with intensity control
            float final_vignette = 1.0f - (1.0f - vignette_factor) * intensity;
            
            // Convert to float and apply vignette
            float rf = (r / 255.0f) * final_vignette;
            float gf = (g / 255.0f) * final_vignette;
            float bf = (b / 255.0f) * final_vignette;
            
            // Clamp and convert back
            rf = fmaxf(0.0f, fminf(1.0f, rf));
            gf = fmaxf(0.0f, fminf(1.0f, gf));
            bf = fmaxf(0.0f, fminf(1.0f, bf));
            
            data[pixel_offset] = (uint8_t)(rf * 255.0f);
            data[pixel_offset + 1] = (uint8_t)(gf * 255.0f);
            data[pixel_offset + 2] = (uint8_t)(bf * 255.0f);
            data[pixel_offset + 3] = a; // Keep original alpha
        }
    }
    
    printf("✅ Vignette filter applied successfully\n");
}