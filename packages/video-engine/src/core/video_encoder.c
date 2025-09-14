#include "../include/video_encoder.h"
#include "../include/video_engine.h"
#include "../include/effects_engine.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>

// Global export job for JavaScript integration
static export_job_t* g_export_job = NULL;

// Create video encoder
video_encoder_t* video_encoder_create(int width, int height, double fps) {
    if (width <= 0 || height <= 0 || fps <= 0) return NULL;

    video_encoder_t* encoder = malloc(sizeof(video_encoder_t));
    if (!encoder) return NULL;

    memset(encoder, 0, sizeof(video_encoder_t));

    encoder->width = width;
    encoder->height = height;
    encoder->fps = fps;
    encoder->quality = 80; // Default quality
    encoder->bitrate = width * height * fps / 10; // Rough estimate
    encoder->format = "webm"; // Default format

    // Allocate frame buffer (RGBA)
    encoder->frame_buffer_size = width * height * 4;
    encoder->frame_buffer = malloc(encoder->frame_buffer_size);
    if (!encoder->frame_buffer) {
        free(encoder);
        return NULL;
    }

    // Create memory pool for processing
    encoder->memory_pool = memory_pool_create(encoder->frame_buffer_size, 4);
    if (!encoder->memory_pool) {
        free(encoder->frame_buffer);
        free(encoder);
        return NULL;
    }

    return encoder;
}

// Destroy video encoder
void video_encoder_destroy(video_encoder_t* encoder) {
    if (!encoder) return;

    if (encoder->frame_buffer) {
        free(encoder->frame_buffer);
    }

    if (encoder->memory_pool) {
        memory_pool_destroy(encoder->memory_pool);
    }

    // Don't destroy effects engine as it's managed externally

    free(encoder);
}

// Initialize encoder for export
bool video_encoder_init(video_encoder_t* encoder, const char* output_path) {
    if (!encoder || !output_path) return false;

    encoder->frame_count = 0;
    encoder->export_progress = 0.0;
    encoder->frames_exported = 0;
    encoder->export_started = false;
    encoder->is_recording = false;

    return true;
}

// Cleanup encoder
void video_encoder_cleanup(video_encoder_t* encoder) {
    if (!encoder) return;

    encoder->is_recording = false;
    encoder->export_started = false;
    encoder->frame_count = 0;
    encoder->export_progress = 0.0;
    encoder->frames_exported = 0;
}

// Start export process
bool video_encoder_start_export(video_encoder_t* encoder, const char* output_path) {
    if (!encoder || !output_path) return false;

    if (!video_encoder_init(encoder, output_path)) {
        return false;
    }

    encoder->export_started = true;
    encoder->is_recording = true;

    return true;
}

// Add frame to export
bool video_encoder_add_frame(video_encoder_t* encoder, uint8_t* frame_data, double timestamp) {
    if (!encoder || !frame_data || !encoder->is_recording) return false;

    // Copy frame data to internal buffer
    memcpy(encoder->frame_buffer, frame_data, encoder->frame_buffer_size);

    // For now, we simulate export by just counting frames
    // In a real implementation, this would encode and write to file
    encoder->frames_exported++;
    encoder->frame_count++;

    return true;
}

// Process frame with effects and export
bool video_encoder_process_and_export_frame(video_encoder_t* encoder, uint8_t* frame_data, int width, int height, double timestamp) {
    if (!encoder || !frame_data) return false;

    // Create temporary frame structure
    video_frame_t frame;
    frame.data = frame_data;
    frame.width = width;
    frame.height = height;
    frame.stride = width * 4;
    frame.format = 1; // RGBA
    frame.timestamp = timestamp;
    frame.frame_number = encoder->frames_exported;

    // Apply effects if effects engine is available
    if (encoder->effects_engine) {
        if (!effects_process_frame(encoder->effects_engine, &frame, timestamp)) {
            return false;
        }
    }

    // Export the processed frame
    return video_encoder_add_frame(encoder, frame_data, timestamp);
}

// Finish export process
bool video_encoder_finish_export(video_encoder_t* encoder) {
    if (!encoder || !encoder->export_started) return false;

    encoder->is_recording = false;
    encoder->export_progress = 1.0;

    // In a real implementation, this would finalize the video file
    return true;
}

// Cancel export process
void video_encoder_cancel_export(video_encoder_t* encoder) {
    if (!encoder) return;

    encoder->is_recording = false;
    encoder->export_started = false;
    encoder->export_progress = 0.0;
}

// Set encoder quality
void video_encoder_set_quality(video_encoder_t* encoder, int quality) {
    if (!encoder) return;
    encoder->quality = (quality < 1) ? 1 : (quality > 100) ? 100 : quality;
}

// Set encoder bitrate
void video_encoder_set_bitrate(video_encoder_t* encoder, int bitrate) {
    if (!encoder) return;
    encoder->bitrate = (bitrate < 1000) ? 1000 : bitrate; // Minimum 1kbps
}

// Set encoder format
void video_encoder_set_format(video_encoder_t* encoder, const char* format) {
    if (!encoder || !format) return;
    encoder->format = format; // Store pointer (assumes string persists)
}

// Get export progress
double video_encoder_get_progress(video_encoder_t* encoder) {
    return encoder ? encoder->export_progress : 0.0;
}

// Get frames exported count
int video_encoder_get_frames_exported(video_encoder_t* encoder) {
    return encoder ? encoder->frames_exported : 0;
}

// Check if currently exporting
bool video_encoder_is_exporting(video_encoder_t* encoder) {
    return encoder ? encoder->is_recording : false;
}

// ============================================================================
// Export Job Management
// ============================================================================

// Create export job
export_job_t* export_job_create(int source_width, int source_height, double source_fps, double duration) {
    export_job_t* job = malloc(sizeof(export_job_t));
    if (!job) return NULL;

    memset(job, 0, sizeof(export_job_t));

    job->source_width = source_width;
    job->source_height = source_height;
    job->source_fps = source_fps;
    job->source_duration = duration;

    // Default output settings (same as source)
    job->output_width = source_width;
    job->output_height = source_height;
    job->output_fps = source_fps;

    // Calculate total frames
    job->total_frames = (int)(duration * source_fps);
    job->start_time = 0.0;
    job->end_time = duration;

    return job;
}

// Destroy export job
void export_job_destroy(export_job_t* job) {
    if (!job) return;

    if (job->encoder) {
        video_encoder_destroy(job->encoder);
    }

    free(job);
}

// Configure export job
bool export_job_configure(export_job_t* job, int output_width, int output_height, double output_fps, const char* output_path) {
    if (!job || !output_path) return false;

    job->output_width = output_width;
    job->output_height = output_height;
    job->output_fps = output_fps;
    job->output_path = output_path;

    // Create encoder with output settings
    if (job->encoder) {
        video_encoder_destroy(job->encoder);
    }

    job->encoder = video_encoder_create(output_width, output_height, output_fps);
    return job->encoder != NULL;
}

// Set effects engine for export job
bool export_job_set_effects_engine(export_job_t* job, effects_engine_t* effects_engine) {
    if (!job) return false;

    job->effects_engine = effects_engine;

    if (job->encoder) {
        job->encoder->effects_engine = effects_engine;
    }

    return true;
}

// Start export job
bool export_job_start(export_job_t* job) {
    if (!job || !job->encoder || !job->output_path) return false;

    if (!video_encoder_start_export(job->encoder, job->output_path)) {
        strcpy(job->error_message, "Failed to start video encoder");
        job->has_error = true;
        return false;
    }

    job->is_running = true;
    job->processed_frames = 0;
    job->current_time = job->start_time;

    return true;
}

// Process frame in export job
bool export_job_process_frame(export_job_t* job, uint8_t* frame_data, double timestamp) {
    if (!job || !job->encoder || !frame_data || !job->is_running) return false;

    // Check if timestamp is within export range
    if (timestamp < job->start_time || timestamp > job->end_time) {
        return true; // Skip frame, but not an error
    }

    // Process frame with effects and export
    bool success = video_encoder_process_and_export_frame(
        job->encoder, frame_data, job->source_width, job->source_height, timestamp
    );

    if (success) {
        job->processed_frames++;
        job->current_time = timestamp;

        // Update progress
        double progress = (timestamp - job->start_time) / (job->end_time - job->start_time);
        job->encoder->export_progress = progress;
    } else {
        strcpy(job->error_message, "Failed to process frame");
        job->has_error = true;
    }

    return success;
}

// Finish export job
bool export_job_finish(export_job_t* job) {
    if (!job || !job->encoder) return false;

    bool success = video_encoder_finish_export(job->encoder);

    job->is_running = false;
    job->is_complete = true;

    if (!success) {
        strcpy(job->error_message, "Failed to finish export");
        job->has_error = true;
    }

    return success;
}

// Get export job progress
double export_job_get_progress(export_job_t* job) {
    if (!job || !job->encoder) return 0.0;
    return video_encoder_get_progress(job->encoder);
}

// ============================================================================
// JavaScript Bindings
// ============================================================================

// Create video encoder from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_video_encoder_create(int width, int height, double fps) {
    video_encoder_t* encoder = video_encoder_create(width, height, fps);
    return (int)(uintptr_t)encoder;
}

// Destroy video encoder from JavaScript
EMSCRIPTEN_KEEPALIVE
void js_video_encoder_destroy(int encoder_ptr) {
    if (encoder_ptr == 0) return;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    video_encoder_destroy(encoder);
}

// Start export from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_video_encoder_start_export(int encoder_ptr, const char* output_path) {
    if (encoder_ptr == 0) return 0;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    return video_encoder_start_export(encoder, output_path) ? 1 : 0;
}

// Add frame from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_video_encoder_add_frame(int encoder_ptr, uint8_t* frame_data, double timestamp) {
    if (encoder_ptr == 0 || !frame_data) return 0;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    return video_encoder_add_frame(encoder, frame_data, timestamp) ? 1 : 0;
}

// Finish export from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_video_encoder_finish_export(int encoder_ptr) {
    if (encoder_ptr == 0) return 0;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    return video_encoder_finish_export(encoder) ? 1 : 0;
}

// Cancel export from JavaScript
EMSCRIPTEN_KEEPALIVE
void js_video_encoder_cancel_export(int encoder_ptr) {
    if (encoder_ptr == 0) return;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    video_encoder_cancel_export(encoder);
}

// Set effects engine from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_video_encoder_set_effects_engine(int encoder_ptr, int effects_engine_ptr) {
    if (encoder_ptr == 0) return 0;

    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    effects_engine_t* effects_engine = NULL;

    if (effects_engine_ptr != 0) {
        effects_engine = (effects_engine_t*)(uintptr_t)effects_engine_ptr;
    }

    encoder->effects_engine = effects_engine;
    return 1;
}

// Process and export frame from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_video_encoder_process_and_export_frame(int encoder_ptr, uint8_t* frame_data, int width, int height, double timestamp) {
    if (encoder_ptr == 0 || !frame_data) return 0;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    return video_encoder_process_and_export_frame(encoder, frame_data, width, height, timestamp) ? 1 : 0;
}

// Export job JavaScript bindings

// Create export job from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_export_job_create(int source_width, int source_height, double source_fps, double duration) {
    export_job_t* job = export_job_create(source_width, source_height, source_fps, duration);
    if (job) {
        g_export_job = job; // Store global reference for convenience
    }
    return (int)(uintptr_t)job;
}

// Destroy export job from JavaScript
EMSCRIPTEN_KEEPALIVE
void js_export_job_destroy(int job_ptr) {
    if (job_ptr == 0) return;
    export_job_t* job = (export_job_t*)(uintptr_t)job_ptr;
    if (g_export_job == job) {
        g_export_job = NULL;
    }
    export_job_destroy(job);
}

// Configure export job from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_export_job_configure(int job_ptr, int output_width, int output_height, double output_fps, const char* output_path) {
    if (job_ptr == 0) return 0;
    export_job_t* job = (export_job_t*)(uintptr_t)job_ptr;
    return export_job_configure(job, output_width, output_height, output_fps, output_path) ? 1 : 0;
}

// Set effects engine for export job from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_export_job_set_effects_engine(int job_ptr, int effects_engine_ptr) {
    if (job_ptr == 0) return 0;
    export_job_t* job = (export_job_t*)(uintptr_t)job_ptr;
    effects_engine_t* effects_engine = (effects_engine_ptr != 0) ?
        (effects_engine_t*)(uintptr_t)effects_engine_ptr : NULL;
    return export_job_set_effects_engine(job, effects_engine) ? 1 : 0;
}

// Start export job from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_export_job_start(int job_ptr) {
    if (job_ptr == 0) return 0;
    export_job_t* job = (export_job_t*)(uintptr_t)job_ptr;
    return export_job_start(job) ? 1 : 0;
}

// Process frame in export job from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_export_job_process_frame(int job_ptr, uint8_t* frame_data, double timestamp) {
    if (job_ptr == 0 || !frame_data) return 0;
    export_job_t* job = (export_job_t*)(uintptr_t)job_ptr;
    return export_job_process_frame(job, frame_data, timestamp) ? 1 : 0;
}

// Finish export job from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_export_job_finish(int job_ptr) {
    if (job_ptr == 0) return 0;
    export_job_t* job = (export_job_t*)(uintptr_t)job_ptr;
    return export_job_finish(job) ? 1 : 0;
}

// Get export job progress from JavaScript
EMSCRIPTEN_KEEPALIVE
double js_export_job_get_progress(int job_ptr) {
    if (job_ptr == 0) return 0.0;
    export_job_t* job = (export_job_t*)(uintptr_t)job_ptr;
    return export_job_get_progress(job);
}

// Configuration JavaScript bindings

EMSCRIPTEN_KEEPALIVE
void js_video_encoder_set_quality(int encoder_ptr, int quality) {
    if (encoder_ptr == 0) return;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    video_encoder_set_quality(encoder, quality);
}

EMSCRIPTEN_KEEPALIVE
void js_video_encoder_set_bitrate(int encoder_ptr, int bitrate) {
    if (encoder_ptr == 0) return;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    video_encoder_set_bitrate(encoder, bitrate);
}

EMSCRIPTEN_KEEPALIVE
void js_video_encoder_set_format(int encoder_ptr, const char* format) {
    if (encoder_ptr == 0) return;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    video_encoder_set_format(encoder, format);
}

// Status JavaScript bindings

EMSCRIPTEN_KEEPALIVE
double js_video_encoder_get_progress(int encoder_ptr) {
    if (encoder_ptr == 0) return 0.0;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    return video_encoder_get_progress(encoder);
}

EMSCRIPTEN_KEEPALIVE
int js_video_encoder_get_frames_exported(int encoder_ptr) {
    if (encoder_ptr == 0) return 0;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    return video_encoder_get_frames_exported(encoder);
}

EMSCRIPTEN_KEEPALIVE
int js_video_encoder_is_exporting(int encoder_ptr) {
    if (encoder_ptr == 0) return 0;
    video_encoder_t* encoder = (video_encoder_t*)(uintptr_t)encoder_ptr;
    return video_encoder_is_exporting(encoder) ? 1 : 0;
}