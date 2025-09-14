#ifndef VIDEO_ENCODER_H
#define VIDEO_ENCODER_H

#include "video_engine.h"
#include "effects_engine.h"

// Video encoder structure
typedef struct video_encoder_t {
    int width;
    int height;
    double fps;
    int frame_count;
    bool is_recording;

    // Output format settings
    int quality;        // 1-100
    int bitrate;        // bits per second
    const char* format; // "webm", "mp4", "avi"

    // Frame buffer for processing
    uint8_t* frame_buffer;
    size_t frame_buffer_size;

    // Effects engine integration
    effects_engine_t* effects_engine;

    // Export state
    bool export_started;
    double export_progress;
    int frames_exported;

    // Memory management
    memory_pool_t* memory_pool;
} video_encoder_t;

// Export job structure for batching
typedef struct export_job_t {
    video_encoder_t* encoder;
    effects_engine_t* effects_engine;

    // Source video info
    int source_width;
    int source_height;
    double source_fps;
    double source_duration;

    // Export settings
    int output_width;
    int output_height;
    double output_fps;
    const char* output_path;

    // Progress tracking
    double start_time;
    double end_time;
    double current_time;
    int total_frames;
    int processed_frames;

    // Status
    bool is_running;
    bool is_complete;
    bool has_error;
    char error_message[256];
} export_job_t;

// Core encoder functions
EMSCRIPTEN_KEEPALIVE video_encoder_t* video_encoder_create(int width, int height, double fps);
EMSCRIPTEN_KEEPALIVE void video_encoder_destroy(video_encoder_t* encoder);
EMSCRIPTEN_KEEPALIVE bool video_encoder_init(video_encoder_t* encoder, const char* output_path);
EMSCRIPTEN_KEEPALIVE void video_encoder_cleanup(video_encoder_t* encoder);

// Export functions
EMSCRIPTEN_KEEPALIVE bool video_encoder_start_export(video_encoder_t* encoder, const char* output_path);
EMSCRIPTEN_KEEPALIVE bool video_encoder_add_frame(video_encoder_t* encoder, uint8_t* frame_data, double timestamp);
EMSCRIPTEN_KEEPALIVE bool video_encoder_finish_export(video_encoder_t* encoder);
EMSCRIPTEN_KEEPALIVE void video_encoder_cancel_export(video_encoder_t* encoder);

// Frame processing with effects
EMSCRIPTEN_KEEPALIVE bool video_encoder_process_and_export_frame(video_encoder_t* encoder, uint8_t* frame_data, int width, int height, double timestamp);

// Export job management
EMSCRIPTEN_KEEPALIVE export_job_t* export_job_create(int source_width, int source_height, double source_fps, double duration);
EMSCRIPTEN_KEEPALIVE void export_job_destroy(export_job_t* job);
EMSCRIPTEN_KEEPALIVE bool export_job_configure(export_job_t* job, int output_width, int output_height, double output_fps, const char* output_path);
EMSCRIPTEN_KEEPALIVE bool export_job_set_effects_engine(export_job_t* job, effects_engine_t* effects_engine);
EMSCRIPTEN_KEEPALIVE bool export_job_start(export_job_t* job);
EMSCRIPTEN_KEEPALIVE bool export_job_process_frame(export_job_t* job, uint8_t* frame_data, double timestamp);
EMSCRIPTEN_KEEPALIVE bool export_job_finish(export_job_t* job);
EMSCRIPTEN_KEEPALIVE double export_job_get_progress(export_job_t* job);

// Settings and configuration
EMSCRIPTEN_KEEPALIVE void video_encoder_set_quality(video_encoder_t* encoder, int quality);
EMSCRIPTEN_KEEPALIVE void video_encoder_set_bitrate(video_encoder_t* encoder, int bitrate);
EMSCRIPTEN_KEEPALIVE void video_encoder_set_format(video_encoder_t* encoder, const char* format);

// Progress and status
EMSCRIPTEN_KEEPALIVE double video_encoder_get_progress(video_encoder_t* encoder);
EMSCRIPTEN_KEEPALIVE int video_encoder_get_frames_exported(video_encoder_t* encoder);
EMSCRIPTEN_KEEPALIVE bool video_encoder_is_exporting(video_encoder_t* encoder);

// JavaScript bindings
EMSCRIPTEN_KEEPALIVE int js_video_encoder_create(int width, int height, double fps);
EMSCRIPTEN_KEEPALIVE void js_video_encoder_destroy(int encoder_ptr);
EMSCRIPTEN_KEEPALIVE int js_video_encoder_start_export(int encoder_ptr, const char* output_path);
EMSCRIPTEN_KEEPALIVE int js_video_encoder_add_frame(int encoder_ptr, uint8_t* frame_data, double timestamp);
EMSCRIPTEN_KEEPALIVE int js_video_encoder_finish_export(int encoder_ptr);
EMSCRIPTEN_KEEPALIVE void js_video_encoder_cancel_export(int encoder_ptr);

// Advanced export with effects
EMSCRIPTEN_KEEPALIVE int js_video_encoder_set_effects_engine(int encoder_ptr, int effects_engine_ptr);
EMSCRIPTEN_KEEPALIVE int js_video_encoder_process_and_export_frame(int encoder_ptr, uint8_t* frame_data, int width, int height, double timestamp);

// Export job JavaScript bindings
EMSCRIPTEN_KEEPALIVE int js_export_job_create(int source_width, int source_height, double source_fps, double duration);
EMSCRIPTEN_KEEPALIVE void js_export_job_destroy(int job_ptr);
EMSCRIPTEN_KEEPALIVE int js_export_job_configure(int job_ptr, int output_width, int output_height, double output_fps, const char* output_path);
EMSCRIPTEN_KEEPALIVE int js_export_job_set_effects_engine(int job_ptr, int effects_engine_ptr);
EMSCRIPTEN_KEEPALIVE int js_export_job_start(int job_ptr);
EMSCRIPTEN_KEEPALIVE int js_export_job_process_frame(int job_ptr, uint8_t* frame_data, double timestamp);
EMSCRIPTEN_KEEPALIVE int js_export_job_finish(int job_ptr);
EMSCRIPTEN_KEEPALIVE double js_export_job_get_progress(int job_ptr);

// Configuration JavaScript bindings
EMSCRIPTEN_KEEPALIVE void js_video_encoder_set_quality(int encoder_ptr, int quality);
EMSCRIPTEN_KEEPALIVE void js_video_encoder_set_bitrate(int encoder_ptr, int bitrate);
EMSCRIPTEN_KEEPALIVE void js_video_encoder_set_format(int encoder_ptr, const char* format);

// Status JavaScript bindings
EMSCRIPTEN_KEEPALIVE double js_video_encoder_get_progress(int encoder_ptr);
EMSCRIPTEN_KEEPALIVE int js_video_encoder_get_frames_exported(int encoder_ptr);
EMSCRIPTEN_KEEPALIVE int js_video_encoder_is_exporting(int encoder_ptr);

#endif // VIDEO_ENCODER_H