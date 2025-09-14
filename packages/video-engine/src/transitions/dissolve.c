#include "transitions.h"
#include <stdio.h>
#include <math.h>
#include <stdlib.h>

void transition_dissolve(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress) {
    if (!frame1 || !frame2 || !output) {
        printf("❌ Invalid frames for dissolve transition\n");
        return;
    }
    
    int width = output->width;
    int height = output->height;
    
    // Ensure progress is between 0 and 1
    progress = fmaxf(0.0f, fminf(1.0f, progress));
    
    printf("🌫️ Applying dissolve transition (progress: %.2f) to %dx%d frames\n", progress, width, height);
    
    // Use a simple pseudo-random pattern for dissolve effect
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = (y * width + x) * 4; // RGBA format
            
            // Create pseudo-random threshold based on pixel position
            float threshold = (float)((x * 31 + y * 17) % 100) / 100.0f;
            
            // Choose which frame to use based on progress and threshold
            if (progress > threshold) {
                // Use frame2
                output->data[idx] = frame2->data[idx];
                output->data[idx + 1] = frame2->data[idx + 1];
                output->data[idx + 2] = frame2->data[idx + 2];
                output->data[idx + 3] = frame2->data[idx + 3];
            } else {
                // Use frame1
                output->data[idx] = frame1->data[idx];
                output->data[idx + 1] = frame1->data[idx + 1];
                output->data[idx + 2] = frame1->data[idx + 2];
                output->data[idx + 3] = frame1->data[idx + 3];
            }
        }
    }
    
    printf("✅ Dissolve transition applied successfully\n");
}