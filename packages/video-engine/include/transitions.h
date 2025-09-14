#ifndef TRANSITIONS_H
#define TRANSITIONS_H

#include "video_engine.h"
#include <emscripten.h>

// Transition function declarations
EMSCRIPTEN_KEEPALIVE void transition_fade(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_dissolve(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_wipe_left(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_wipe_right(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_wipe_up(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);
EMSCRIPTEN_KEEPALIVE void transition_wipe_down(video_frame_t* frame1, video_frame_t* frame2, video_frame_t* output, float progress);

#endif // TRANSITIONS_H