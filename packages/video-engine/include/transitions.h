#ifndef TRANSITIONS_H
#define TRANSITIONS_H

#include "video_engine.h"
#include <emscripten.h>

// Transition types
typedef enum {
    TRANSITION_FADE,
    TRANSITION_DISSOLVE,
    TRANSITION_WIPE_LEFT,
    TRANSITION_WIPE_RIGHT,
    TRANSITION_WIPE_UP,
    TRANSITION_WIPE_DOWN
} transition_type_t;

// Transition parameters
typedef struct {
    transition_type_t type;
    float duration;        // Duration in seconds
    float progress;        // Current progress 0.0 to 1.0
    float ease_in;         // Ease in factor
    float ease_out;        // Ease out factor
} transition_params_t;

// Transition function declarations
EMSCRIPTEN_KEEPALIVE void transition_fade(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_dissolve(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_wipe_left(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_wipe_right(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_wipe_up(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_wipe_down(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);

#endif // TRANSITIONS_H