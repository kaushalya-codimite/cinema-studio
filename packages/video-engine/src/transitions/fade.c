#include "transitions.h"
#include <stdio.h>
#include <math.h>

void transition_fade(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress) {
    if (!frame1 || !frame2 || !output) {
        printf("❌ Invalid frames for fade transition\n");
        return;
    }
    
    int width = output->width;
    int height = output->height;
    
    // Ensure progress is between 0 and 1
    progress = fmaxf(0.0f, fminf(1.0f, progress));
    
    printf("🎭 Applying fade transition (progress: %.2f) to %dx%d frames\n", progress, width, height);
    
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = (y * width + x) * 4; // RGBA format
            
            // Get pixel values from both frames
            uint8_t r1 = frame1->data[idx];
            uint8_t g1 = frame1->data[idx + 1];
            uint8_t b1 = frame1->data[idx + 2];
            uint8_t a1 = frame1->data[idx + 3];
            
            uint8_t r2 = frame2->data[idx];
            uint8_t g2 = frame2->data[idx + 1];
            uint8_t b2 = frame2->data[idx + 2];
            uint8_t a2 = frame2->data[idx + 3];
            
            // Linear interpolation between frames
            float alpha1 = 1.0f - progress;
            float alpha2 = progress;
            
            output->data[idx] = (uint8_t)(r1 * alpha1 + r2 * alpha2);
            output->data[idx + 1] = (uint8_t)(g1 * alpha1 + g2 * alpha2);
            output->data[idx + 2] = (uint8_t)(b1 * alpha1 + b2 * alpha2);
            output->data[idx + 3] = (uint8_t)(a1 * alpha1 + a2 * alpha2);
        }
    }
    
    printf("✅ Fade transition applied successfully\n");
}