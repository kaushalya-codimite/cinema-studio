#include "../include/effects_engine.h"
#include "../include/video_engine.h"
#include "../include/filters.h"
#include "../include/transitions.h"
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>

// Global effects engine instance
static effects_engine_t* g_effects_engine = NULL;

// Comparison function for sorting effects by priority
static int effect_compare(const void* a, const void* b) {
    const effect_t* effect_a = (const effect_t*)a;
    const effect_t* effect_b = (const effect_t*)b;
    return (int)(effect_a->priority - effect_b->priority);
}

// Create effects engine
effects_engine_t* effects_engine_create(void) {
    effects_engine_t* engine = malloc(sizeof(effects_engine_t));
    if (!engine) return NULL;

    memset(engine, 0, sizeof(effects_engine_t));

    // Create memory pool for effects processing
    engine->memory_pool = memory_pool_create(1920 * 1080 * 4, 8); // 8 RGBA frames
    if (!engine->memory_pool) {
        free(engine);
        return NULL;
    }

    // Create effect chain
    engine->chain = effect_chain_create();
    if (!engine->chain) {
        memory_pool_destroy(engine->memory_pool);
        free(engine);
        return NULL;
    }

    engine->chain->memory_pool = engine->memory_pool;
    engine->initialized = true;

    return engine;
}

// Destroy effects engine
void effects_engine_destroy(effects_engine_t* engine) {
    if (!engine) return;

    if (engine->chain) {
        effect_chain_destroy(engine->chain);
    }

    if (engine->memory_pool) {
        memory_pool_destroy(engine->memory_pool);
    }

    if (engine->encoder) {
        // Clean up encoder if exists
        // video_encoder_destroy(engine->encoder);
    }

    free(engine);
}

// Initialize effects engine
bool effects_engine_init(effects_engine_t* engine) {
    if (!engine) return false;

    engine->frames_processed = 0;
    engine->last_process_time_ms = 0.0;
    engine->export_mode = false;

    return true;
}

// Cleanup effects engine
void effects_engine_cleanup(effects_engine_t* engine) {
    if (!engine) return;

    if (engine->chain) {
        effect_chain_clear(engine->chain);
    }
}

// Create effect chain
effect_chain_t* effect_chain_create(void) {
    effect_chain_t* chain = malloc(sizeof(effect_chain_t));
    if (!chain) return NULL;

    memset(chain, 0, sizeof(effect_chain_t));
    chain->count = 0;
    chain->sorted = true;
    chain->temp_frames_allocated = false;

    return chain;
}

// Destroy effect chain
void effect_chain_destroy(effect_chain_t* chain) {
    if (!chain) return;

    // Clean up temporary frames
    if (chain->temp_frames_allocated) {
        if (chain->temp_frame_1) {
            if (chain->memory_pool && chain->temp_frame_1->data) {
                memory_pool_free(chain->memory_pool, chain->temp_frame_1->data);
            }
            free(chain->temp_frame_1);
        }
        if (chain->temp_frame_2) {
            if (chain->memory_pool && chain->temp_frame_2->data) {
                memory_pool_free(chain->memory_pool, chain->temp_frame_2->data);
            }
            free(chain->temp_frame_2);
        }
    }

    free(chain);
}

// Add effect to chain
int effect_chain_add(effect_chain_t* chain, effect_t* effect) {
    if (!chain || !effect || chain->count >= MAX_EFFECTS_CHAIN) {
        return -1;
    }

    // Copy effect to chain
    memcpy(&chain->effects[chain->count], effect, sizeof(effect_t));
    chain->count++;
    chain->sorted = false;

    return chain->count - 1;
}

// Remove effect from chain
bool effect_chain_remove(effect_chain_t* chain, int index) {
    if (!chain || index < 0 || index >= chain->count) {
        return false;
    }

    // Shift effects down
    for (int i = index; i < chain->count - 1; i++) {
        memcpy(&chain->effects[i], &chain->effects[i + 1], sizeof(effect_t));
    }

    chain->count--;
    return true;
}

// Clear effect chain
void effect_chain_clear(effect_chain_t* chain) {
    if (!chain) return;

    chain->count = 0;
    chain->sorted = true;
}

// Sort effects by priority
void effect_chain_sort(effect_chain_t* chain) {
    if (!chain || chain->count <= 1 || chain->sorted) return;

    qsort(chain->effects, chain->count, sizeof(effect_t), effect_compare);
    chain->sorted = true;
}

// Allocate temporary frames for processing
static bool allocate_temp_frames(effect_chain_t* chain, int width, int height) {
    if (!chain || !chain->memory_pool) return false;

    if (chain->temp_frames_allocated) return true;

    // Allocate frame structures
    chain->temp_frame_1 = malloc(sizeof(video_frame_t));
    chain->temp_frame_2 = malloc(sizeof(video_frame_t));

    if (!chain->temp_frame_1 || !chain->temp_frame_2) {
        return false;
    }

    // Allocate frame data from memory pool
    int frame_size = width * height * 4; // RGBA
    chain->temp_frame_1->data = memory_pool_alloc(chain->memory_pool);
    chain->temp_frame_2->data = memory_pool_alloc(chain->memory_pool);

    if (!chain->temp_frame_1->data || !chain->temp_frame_2->data) {
        return false;
    }

    // Initialize frame metadata
    chain->temp_frame_1->width = width;
    chain->temp_frame_1->height = height;
    chain->temp_frame_1->stride = width * 4;
    chain->temp_frame_1->format = 1; // RGBA

    chain->temp_frame_2->width = width;
    chain->temp_frame_2->height = height;
    chain->temp_frame_2->stride = width * 4;
    chain->temp_frame_2->format = 1; // RGBA

    chain->temp_frames_allocated = true;
    return true;
}

// Process frame through effect chain
bool effects_process_frame_chain(effect_chain_t* chain, video_frame_t* frame, double timestamp) {
    if (!chain || !frame || chain->count == 0) {
        return true; // No effects to apply
    }

    // Sort effects if needed
    if (!chain->sorted) {
        effect_chain_sort(chain);
    }

    // Allocate temporary frames if needed
    if (!allocate_temp_frames(chain, frame->width, frame->height)) {
        return false;
    }

    video_frame_t* current_frame = frame;
    video_frame_t* temp_frame = chain->temp_frame_1;

    // Process each effect in priority order
    for (int i = 0; i < chain->count; i++) {
        effect_t* effect = &chain->effects[i];

        if (!effect->enabled) continue;

        // Check if effect is active at this timestamp
        if (timestamp < effect->start_time || timestamp > effect->end_time) {
            continue;
        }

        // Copy current frame to temp frame if we need to preserve original
        if (i > 0) {
            memcpy(temp_frame->data, current_frame->data,
                   current_frame->width * current_frame->height * 4);
            temp_frame->timestamp = current_frame->timestamp;
            temp_frame->frame_number = current_frame->frame_number;
            current_frame = temp_frame;
        }

        // Apply effect based on type
        switch (effect->type) {
            case EFFECT_TYPE_COLOR_CORRECTION:
                filter_color_correction(current_frame, &effect->params.color_correction);
                break;

            case EFFECT_TYPE_FILTER:
                switch (effect->params.filter.type) {
                    case FILTER_BLUR:
                        filter_blur(current_frame, &effect->params.blur);
                        break;
                    case FILTER_SHARPEN:
                        filter_sharpen(current_frame, effect->params.filter.intensity);
                        break;
                    case FILTER_EDGE_DETECTION:
                        filter_edge_detection_new(current_frame, effect->params.filter.intensity);
                        break;
                    default:
                        filter_apply(current_frame, &effect->params.filter);
                        break;
                }
                break;

            case EFFECT_TYPE_TRANSFORM:
                filter_transform(current_frame, &effect->params.transform);
                break;

            case EFFECT_TYPE_TRANSITION:
                // Transitions require two frames - handled separately
                break;
        }

        // Swap temp frames for next iteration
        if (temp_frame == chain->temp_frame_1) {
            temp_frame = chain->temp_frame_2;
        } else {
            temp_frame = chain->temp_frame_1;
        }
    }

    // Copy final result back to original frame if we used temp frames
    if (current_frame != frame) {
        memcpy(frame->data, current_frame->data,
               frame->width * frame->height * 4);
    }

    return true;
}

// Process frame through effects engine
bool effects_process_frame(effects_engine_t* engine, video_frame_t* frame, double timestamp) {
    if (!engine || !engine->initialized) return false;

    clock_t start_time = clock();

    frame->timestamp = timestamp;
    bool result = effects_process_frame_chain(engine->chain, frame, timestamp);

    // Update performance metrics
    clock_t end_time = clock();
    engine->last_process_time_ms = ((double)(end_time - start_time) / CLOCKS_PER_SEC) * 1000.0;
    engine->frames_processed++;

    return result;
}

// Effect creation helpers
effect_t* effect_create_color_correction(float brightness, float contrast, float saturation, float hue) {
    effect_t* effect = malloc(sizeof(effect_t));
    if (!effect) return NULL;

    memset(effect, 0, sizeof(effect_t));
    effect->type = EFFECT_TYPE_COLOR_CORRECTION;
    effect->priority = EFFECT_PRIORITY_COLOR_CORRECTION;
    effect->enabled = true;
    effect->start_time = 0.0;
    effect->end_time = INFINITY;

    effect->params.color_correction.brightness = brightness;
    effect->params.color_correction.contrast = contrast;
    effect->params.color_correction.saturation = saturation;
    effect->params.color_correction.hue = hue;
    effect->params.color_correction.gamma = 1.0f;
    effect->params.color_correction.exposure = 0.0f;

    return effect;
}

effect_t* effect_create_blur(float radius, bool gaussian) {
    effect_t* effect = malloc(sizeof(effect_t));
    if (!effect) return NULL;

    memset(effect, 0, sizeof(effect_t));
    effect->type = EFFECT_TYPE_FILTER;
    effect->priority = EFFECT_PRIORITY_FILTER;
    effect->enabled = true;
    effect->start_time = 0.0;
    effect->end_time = INFINITY;

    effect->params.blur.radius = radius;
    effect->params.blur.gaussian = gaussian;
    effect->params.blur.iterations = 1;

    return effect;
}

effect_t* effect_create_transform(float scale, float rotation, int flip_h, int flip_v) {
    effect_t* effect = malloc(sizeof(effect_t));
    if (!effect) return NULL;

    memset(effect, 0, sizeof(effect_t));
    effect->type = EFFECT_TYPE_TRANSFORM;
    effect->priority = EFFECT_PRIORITY_TRANSFORM;
    effect->enabled = true;
    effect->start_time = 0.0;
    effect->end_time = INFINITY;

    effect->params.transform.scale = scale;
    effect->params.transform.rotation = rotation;
    effect->params.transform.flip_horizontal = flip_h;
    effect->params.transform.flip_vertical = flip_v;
    effect->params.transform.crop_x = 0;
    effect->params.transform.crop_y = 0;
    effect->params.transform.crop_width = 100;
    effect->params.transform.crop_height = 100;

    return effect;
}

effect_t* effect_create_filter(filter_type_t type, float intensity) {
    effect_t* effect = malloc(sizeof(effect_t));
    if (!effect) return NULL;

    memset(effect, 0, sizeof(effect_t));
    effect->type = EFFECT_TYPE_FILTER;
    effect->priority = EFFECT_PRIORITY_FILTER;
    effect->enabled = true;
    effect->start_time = 0.0;
    effect->end_time = INFINITY;

    effect->params.filter.type = type;
    effect->params.filter.intensity = intensity;
    effect->params.filter.enabled = true;

    return effect;
}

// Performance metrics
double effects_engine_get_last_process_time(effects_engine_t* engine) {
    return engine ? engine->last_process_time_ms : 0.0;
}

void effects_engine_get_stats(effects_engine_t* engine, int* frames_processed, double* avg_time) {
    if (!engine) {
        if (frames_processed) *frames_processed = 0;
        if (avg_time) *avg_time = 0.0;
        return;
    }

    if (frames_processed) *frames_processed = engine->frames_processed;
    if (avg_time) *avg_time = engine->last_process_time_ms;
}

// ============================================================================
// JavaScript Bindings
// ============================================================================

// Create effects engine from JavaScript
EMSCRIPTEN_KEEPALIVE
int js_effects_engine_create(void) {
    effects_engine_t* engine = effects_engine_create();
    if (!engine) return 0;

    if (!effects_engine_init(engine)) {
        effects_engine_destroy(engine);
        return 0;
    }

    g_effects_engine = engine; // Store global reference
    return (int)(uintptr_t)engine;
}

// Destroy effects engine from JavaScript
EMSCRIPTEN_KEEPALIVE
void js_effects_engine_destroy(int engine_ptr) {
    if (engine_ptr == 0) return;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    effects_engine_cleanup(engine);
    effects_engine_destroy(engine);

    if (g_effects_engine == engine) {
        g_effects_engine = NULL;
    }
}

// Add color correction effect
EMSCRIPTEN_KEEPALIVE
int js_effect_chain_add_color_correction(int engine_ptr, float brightness, float contrast, float saturation, float hue) {
    if (engine_ptr == 0) return -1;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    if (!engine || !engine->chain) return -1;

    effect_t* effect = effect_create_color_correction(brightness, contrast, saturation, hue);
    if (!effect) return -1;

    int index = effect_chain_add(engine->chain, effect);
    free(effect); // Chain makes a copy

    return index;
}

// Add blur effect
EMSCRIPTEN_KEEPALIVE
int js_effect_chain_add_blur(int engine_ptr, float radius, int gaussian) {
    if (engine_ptr == 0) return -1;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    if (!engine || !engine->chain) return -1;

    effect_t* effect = effect_create_blur(radius, gaussian != 0);
    if (!effect) return -1;

    int index = effect_chain_add(engine->chain, effect);
    free(effect);

    return index;
}

// Add transform effect
EMSCRIPTEN_KEEPALIVE
int js_effect_chain_add_transform(int engine_ptr, float scale, float rotation, int flip_h, int flip_v) {
    if (engine_ptr == 0) return -1;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    if (!engine || !engine->chain) return -1;

    effect_t* effect = effect_create_transform(scale, rotation, flip_h, flip_v);
    if (!effect) return -1;

    int index = effect_chain_add(engine->chain, effect);
    free(effect);

    return index;
}

// Add generic filter effect
EMSCRIPTEN_KEEPALIVE
int js_effect_chain_add_filter(int engine_ptr, int filter_type, float intensity) {
    if (engine_ptr == 0) return -1;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    if (!engine || !engine->chain) return -1;

    effect_t* effect = effect_create_filter((filter_type_t)filter_type, intensity);
    if (!effect) return -1;

    int index = effect_chain_add(engine->chain, effect);
    free(effect);

    return index;
}

// Clear all effects
EMSCRIPTEN_KEEPALIVE
void js_effect_chain_clear(int engine_ptr) {
    if (engine_ptr == 0) return;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    if (!engine || !engine->chain) return;

    effect_chain_clear(engine->chain);
}

// Process frame with all effects
EMSCRIPTEN_KEEPALIVE
int js_effects_process_frame(int engine_ptr, uint8_t* frame_data, int width, int height, int format, double timestamp) {
    if (engine_ptr == 0 || !frame_data || width <= 0 || height <= 0) return 0;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    if (!engine) return 0;

    // Create temporary frame structure
    video_frame_t frame;
    frame.data = frame_data;
    frame.width = width;
    frame.height = height;
    frame.stride = width * 4; // Assume RGBA
    frame.format = format;
    frame.timestamp = timestamp;
    frame.frame_number = engine->frames_processed;

    return effects_process_frame(engine, &frame, timestamp) ? 1 : 0;
}

// Get effect chain count
EMSCRIPTEN_KEEPALIVE
int js_effect_chain_get_count(int engine_ptr) {
    if (engine_ptr == 0) return 0;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    if (!engine || !engine->chain) return 0;

    return engine->chain->count;
}

// Remove effect by index
EMSCRIPTEN_KEEPALIVE
int js_effect_chain_remove(int engine_ptr, int index) {
    if (engine_ptr == 0) return 0;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    if (!engine || !engine->chain) return 0;

    return effect_chain_remove(engine->chain, index) ? 1 : 0;
}

// Get performance stats
EMSCRIPTEN_KEEPALIVE
double js_effects_get_last_process_time(int engine_ptr) {
    if (engine_ptr == 0) return 0.0;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    return effects_engine_get_last_process_time(engine);
}

// Get frames processed count
EMSCRIPTEN_KEEPALIVE
int js_effects_get_frames_processed(int engine_ptr) {
    if (engine_ptr == 0) return 0;

    effects_engine_t* engine = (effects_engine_t*)(uintptr_t)engine_ptr;
    return engine ? engine->frames_processed : 0;
}