#include "video_engine.h"
#include <stdlib.h>
#include <string.h>
#include <stddef.h>

memory_pool_t* memory_pool_create(size_t block_size, int block_count) {
    if (block_size == 0 || block_count <= 0) return NULL;
    
    memory_pool_t* pool = (memory_pool_t*)malloc(sizeof(memory_pool_t));
    if (!pool) return NULL;
    
    // Allocate the main pool
    pool->pool_size = block_size * block_count;
    pool->pool = (uint8_t*)malloc(pool->pool_size);
    if (!pool->pool) {
        free(pool);
        return NULL;
    }
    
    // Allocate usage tracking array
    pool->used_blocks = (bool*)calloc(block_count, sizeof(bool));
    if (!pool->used_blocks) {
        free(pool->pool);
        free(pool);
        return NULL;
    }
    
    pool->block_size = block_size;
    pool->total_blocks = block_count;
    pool->used_count = 0;
    
    return pool;
}

void memory_pool_destroy(memory_pool_t* pool) {
    if (!pool) return;
    
    if (pool->pool) {
        free(pool->pool);
    }
    
    if (pool->used_blocks) {
        free(pool->used_blocks);
    }
    
    free(pool);
}

uint8_t* memory_pool_alloc(memory_pool_t* pool) {
    if (!pool || pool->used_count >= pool->total_blocks) return NULL;
    
    // Find first available block
    for (int i = 0; i < pool->total_blocks; i++) {
        if (!pool->used_blocks[i]) {
            pool->used_blocks[i] = true;
            pool->used_count++;
            return pool->pool + (i * pool->block_size);
        }
    }
    
    return NULL; // Pool is full
}

void memory_pool_free(memory_pool_t* pool, uint8_t* ptr) {
    if (!pool || !ptr) return;
    
    // Calculate block index
    ptrdiff_t offset = ptr - pool->pool;
    if (offset < 0 || offset >= (ptrdiff_t)pool->pool_size) return; // Invalid pointer
    
    int block_index = (int)(offset / pool->block_size);
    if (block_index >= pool->total_blocks) return; // Invalid block
    
    if (pool->used_blocks[block_index]) {
        pool->used_blocks[block_index] = false;
        pool->used_count--;
        
        // Clear the memory block for security
        memset(ptr, 0, pool->block_size);
    }
}