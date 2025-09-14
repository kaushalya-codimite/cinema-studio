#include "transitions.h"
#include <stdio.h>
#include <math.h>

void transition_wipe_left(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress) {
    if (!frame1 || !frame2 || !output) {
        printf("❌ Invalid frames for wipe left transition\n");
        return;
    }
    
    int width = output->width;
    int height = output->height;
    
    // Ensure progress is between 0 and 1
    progress = fmaxf(0.0f, fminf(1.0f, progress));
    
    printf("👈 Applying wipe left transition (progress: %.2f) to %dx%d frames\n", progress, width, height);
    
    // Calculate the wipe boundary
    int wipe_x = (int)(progress * width);
    
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = (y * width + x) * 4; // RGBA format
            
            if (x < wipe_x) {
                // Show frame2 (new frame)
                output->data[idx] = frame2->data[idx];
                output->data[idx + 1] = frame2->data[idx + 1];
                output->data[idx + 2] = frame2->data[idx + 2];
                output->data[idx + 3] = frame2->data[idx + 3];
            } else {
                // Show frame1 (old frame)
                output->data[idx] = frame1->data[idx];
                output->data[idx + 1] = frame1->data[idx + 1];
                output->data[idx + 2] = frame1->data[idx + 2];
                output->data[idx + 3] = frame1->data[idx + 3];
            }
        }
    }
    
    printf("✅ Wipe left transition applied successfully\n");
}

void transition_wipe_right(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress) {
    if (!frame1 || !frame2 || !output) {
        printf("❌ Invalid frames for wipe right transition\n");
        return;
    }
    
    int width = output->width;
    int height = output->height;
    
    // Ensure progress is between 0 and 1
    progress = fmaxf(0.0f, fminf(1.0f, progress));
    
    printf("👉 Applying wipe right transition (progress: %.2f) to %dx%d frames\n", progress, width, height);
    
    // Calculate the wipe boundary (from right)
    int wipe_x = width - (int)(progress * width);
    
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = (y * width + x) * 4; // RGBA format
            
            if (x >= wipe_x) {
                // Show frame2 (new frame)
                output->data[idx] = frame2->data[idx];
                output->data[idx + 1] = frame2->data[idx + 1];
                output->data[idx + 2] = frame2->data[idx + 2];
                output->data[idx + 3] = frame2->data[idx + 3];
            } else {
                // Show frame1 (old frame)
                output->data[idx] = frame1->data[idx];
                output->data[idx + 1] = frame1->data[idx + 1];
                output->data[idx + 2] = frame1->data[idx + 2];
                output->data[idx + 3] = frame1->data[idx + 3];
            }
        }
    }
    
    printf("✅ Wipe right transition applied successfully\n");
}

void transition_wipe_up(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress) {
    if (!frame1 || !frame2 || !output) {
        printf("❌ Invalid frames for wipe up transition\n");
        return;
    }
    
    int width = output->width;
    int height = output->height;
    
    // Ensure progress is between 0 and 1
    progress = fmaxf(0.0f, fminf(1.0f, progress));
    
    printf("👆 Applying wipe up transition (progress: %.2f) to %dx%d frames\n", progress, width, height);
    
    // Calculate the wipe boundary (from bottom up)
    int wipe_y = height - (int)(progress * height);
    
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = (y * width + x) * 4; // RGBA format
            
            if (y >= wipe_y) {
                // Show frame2 (new frame)
                output->data[idx] = frame2->data[idx];
                output->data[idx + 1] = frame2->data[idx + 1];
                output->data[idx + 2] = frame2->data[idx + 2];
                output->data[idx + 3] = frame2->data[idx + 3];
            } else {
                // Show frame1 (old frame)
                output->data[idx] = frame1->data[idx];
                output->data[idx + 1] = frame1->data[idx + 1];
                output->data[idx + 2] = frame1->data[idx + 2];
                output->data[idx + 3] = frame1->data[idx + 3];
            }
        }
    }
    
    printf("✅ Wipe up transition applied successfully\n");
}

void transition_wipe_down(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress) {
    if (!frame1 || !frame2 || !output) {
        printf("❌ Invalid frames for wipe down transition\n");
        return;
    }
    
    int width = output->width;
    int height = output->height;
    
    // Ensure progress is between 0 and 1
    progress = fmaxf(0.0f, fminf(1.0f, progress));
    
    printf("👇 Applying wipe down transition (progress: %.2f) to %dx%d frames\n", progress, width, height);
    
    // Calculate the wipe boundary (from top down)
    int wipe_y = (int)(progress * height);
    
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = (y * width + x) * 4; // RGBA format
            
            if (y < wipe_y) {
                // Show frame2 (new frame)
                output->data[idx] = frame2->data[idx];
                output->data[idx + 1] = frame2->data[idx + 1];
                output->data[idx + 2] = frame2->data[idx + 2];
                output->data[idx + 3] = frame2->data[idx + 3];
            } else {
                // Show frame1 (old frame)
                output->data[idx] = frame1->data[idx];
                output->data[idx + 1] = frame1->data[idx + 1];
                output->data[idx + 2] = frame1->data[idx + 2];
                output->data[idx + 3] = frame1->data[idx + 3];
            }
        }
    }
    
    printf("✅ Wipe down transition applied successfully\n");
}