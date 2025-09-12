#ifndef VIDEO_ENGINE_H
#define VIDEO_ENGINE_H

#include <stdint.h>
#include <stdbool.h>
#include <emscripten.h>

// Forward declarations
typedef struct video_frame_t video_frame_t;
typedef struct video_decoder_t video_decoder_t;
typedef struct video_encoder_t video_encoder_t;
typedef struct memory_pool_t memory_pool_t;

// Video frame structure
typedef struct video_frame_t {
    uint8_t* data;
    int width;
    int height;
    int stride;
    int format; // 0=RGB, 1=RGBA, 2=YUV420
    double timestamp;
    int frame_number;
} video_frame_t;

// Video decoder structure
typedef struct video_decoder_t {
    void* context;
    int width;
    int height;
    double fps;
    double duration;
    int total_frames;
    bool is_open;
    uint8_t* data; // Frame buffer for export functionality
} video_decoder_t;

// Memory pool for efficient frame management
typedef struct memory_pool_t {
    uint8_t* pool;
    size_t pool_size;
    size_t block_size;
    bool* used_blocks;
    int total_blocks;
    int used_count;
} memory_pool_t;

// Core engine functions
EMSCRIPTEN_KEEPALIVE video_decoder_t* video_decoder_create(void);
EMSCRIPTEN_KEEPALIVE void video_decoder_destroy(video_decoder_t* decoder);
EMSCRIPTEN_KEEPALIVE bool video_decoder_open(video_decoder_t* decoder, const uint8_t* data, size_t size);
EMSCRIPTEN_KEEPALIVE video_frame_t* video_decoder_get_frame(video_decoder_t* decoder, int frame_number);
EMSCRIPTEN_KEEPALIVE void video_frame_destroy(video_frame_t* frame);

// Memory management
EMSCRIPTEN_KEEPALIVE memory_pool_t* memory_pool_create(size_t block_size, int block_count);
EMSCRIPTEN_KEEPALIVE void memory_pool_destroy(memory_pool_t* pool);
EMSCRIPTEN_KEEPALIVE uint8_t* memory_pool_alloc(memory_pool_t* pool);
EMSCRIPTEN_KEEPALIVE void memory_pool_free(memory_pool_t* pool, uint8_t* ptr);

// Frame processing
EMSCRIPTEN_KEEPALIVE void video_frame_resize(video_frame_t* src, video_frame_t* dst, int new_width, int new_height);
EMSCRIPTEN_KEEPALIVE void video_frame_crop(video_frame_t* src, video_frame_t* dst, int x, int y, int width, int height);
EMSCRIPTEN_KEEPALIVE void video_frame_convert_rgb_to_rgba(video_frame_t* src, video_frame_t* dst);

// Utility functions
EMSCRIPTEN_KEEPALIVE void video_engine_init(void);
EMSCRIPTEN_KEEPALIVE void video_engine_cleanup(void);
EMSCRIPTEN_KEEPALIVE const char* video_engine_version(void);

#endif // VIDEO_ENGINE_H