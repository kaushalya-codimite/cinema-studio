#include "filters.h"
#include <math.h>
#include <stdlib.h>

// Clamp value between 0 and 255
static inline uint8_t clamp_uint8(float value) {
    if (value < 0.0f) return 0;
    if (value > 255.0f) return 255;
    return (uint8_t)value;
}

// Convert RGB to HSV
static void rgb_to_hsv(uint8_t r, uint8_t g, uint8_t b, float* h, float* s, float* v) {
    float rf = r / 255.0f;
    float gf = g / 255.0f;
    float bf = b / 255.0f;
    
    float max_val = fmaxf(rf, fmaxf(gf, bf));
    float min_val = fminf(rf, fminf(gf, bf));
    float delta = max_val - min_val;
    
    *v = max_val;
    
    if (max_val == 0.0f) {
        *s = 0.0f;
    } else {
        *s = delta / max_val;
    }
    
    if (delta == 0.0f) {
        *h = 0.0f;
    } else if (max_val == rf) {
        *h = 60.0f * ((gf - bf) / delta);
        if (*h < 0.0f) *h += 360.0f;
    } else if (max_val == gf) {
        *h = 60.0f * ((bf - rf) / delta) + 120.0f;
    } else {
        *h = 60.0f * ((rf - gf) / delta) + 240.0f;
    }
}

// Convert HSV to RGB
static void hsv_to_rgb(float h, float s, float v, uint8_t* r, uint8_t* g, uint8_t* b) {
    if (s == 0.0f) {
        *r = *g = *b = clamp_uint8(v * 255.0f);
        return;
    }
    
    h = fmodf(h, 360.0f);
    if (h < 0.0f) h += 360.0f;
    
    int hi = (int)(h / 60.0f);
    float f = (h / 60.0f) - hi;
    float p = v * (1.0f - s);
    float q = v * (1.0f - s * f);
    float t = v * (1.0f - s * (1.0f - f));
    
    switch (hi) {
        case 0: *r = clamp_uint8(v * 255.0f); *g = clamp_uint8(t * 255.0f); *b = clamp_uint8(p * 255.0f); break;
        case 1: *r = clamp_uint8(q * 255.0f); *g = clamp_uint8(v * 255.0f); *b = clamp_uint8(p * 255.0f); break;
        case 2: *r = clamp_uint8(p * 255.0f); *g = clamp_uint8(v * 255.0f); *b = clamp_uint8(t * 255.0f); break;
        case 3: *r = clamp_uint8(p * 255.0f); *g = clamp_uint8(q * 255.0f); *b = clamp_uint8(v * 255.0f); break;
        case 4: *r = clamp_uint8(t * 255.0f); *g = clamp_uint8(p * 255.0f); *b = clamp_uint8(v * 255.0f); break;
        default: *r = clamp_uint8(v * 255.0f); *g = clamp_uint8(p * 255.0f); *b = clamp_uint8(q * 255.0f); break;
    }
}

void filter_color_correction(video_frame_t* frame, color_correction_t* params) {
    if (!frame || !frame->data || !params || frame->format != 1) return; // RGBA only
    
    int pixel_count = frame->width * frame->height;
    uint8_t* data = frame->data;
    
    for (int i = 0; i < pixel_count; i++) {
        int idx = i * 4;
        uint8_t r = data[idx + 0];
        uint8_t g = data[idx + 1];
        uint8_t b = data[idx + 2];
        uint8_t a = data[idx + 3];
        
        // Convert to float for processing
        float rf = r / 255.0f;
        float gf = g / 255.0f;
        float bf = b / 255.0f;
        
        // Apply brightness
        rf += params->brightness;
        gf += params->brightness;
        bf += params->brightness;
        
        // Apply contrast
        rf = (rf - 0.5f) * (1.0f + params->contrast) + 0.5f;
        gf = (gf - 0.5f) * (1.0f + params->contrast) + 0.5f;
        bf = (bf - 0.5f) * (1.0f + params->contrast) + 0.5f;
        
        // Apply gamma correction
        if (params->gamma != 1.0f) {
            rf = powf(fmaxf(rf, 0.0f), 1.0f / params->gamma);
            gf = powf(fmaxf(gf, 0.0f), 1.0f / params->gamma);
            bf = powf(fmaxf(bf, 0.0f), 1.0f / params->gamma);
        }
        
        // Apply exposure
        float exposure_multiplier = powf(2.0f, params->exposure);
        rf *= exposure_multiplier;
        gf *= exposure_multiplier;
        bf *= exposure_multiplier;
        
        // Apply saturation and hue adjustments using HSV
        if (params->saturation != 0.0f || params->hue != 0.0f) {
            float h, s, v;
            rgb_to_hsv(clamp_uint8(rf * 255.0f), clamp_uint8(gf * 255.0f), clamp_uint8(bf * 255.0f), &h, &s, &v);
            
            // Adjust hue
            h += params->hue;
            
            // Adjust saturation
            s *= (1.0f + params->saturation);
            s = fmaxf(0.0f, fminf(1.0f, s));
            
            hsv_to_rgb(h, s, v, &r, &g, &b);
        } else {
            r = clamp_uint8(rf * 255.0f);
            g = clamp_uint8(gf * 255.0f);
            b = clamp_uint8(bf * 255.0f);
        }
        
        // Write back to buffer
        data[idx + 0] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a; // Preserve alpha
    }
}

void apply_real_time_filter(uint8_t* frame_data, int width, int height, 
                           filter_type_t filter, float intensity) {
    if (!frame_data || width <= 0 || height <= 0) return;
    
    int pixel_count = width * height;
    
    switch (filter) {
        case FILTER_BRIGHTNESS: {
            float brightness = intensity * 0.5f; // Scale to reasonable range
            for (int i = 0; i < pixel_count * 4; i += 4) {
                frame_data[i + 0] = clamp_uint8(frame_data[i + 0] + brightness * 255.0f);
                frame_data[i + 1] = clamp_uint8(frame_data[i + 1] + brightness * 255.0f);
                frame_data[i + 2] = clamp_uint8(frame_data[i + 2] + brightness * 255.0f);
            }
            break;
        }
        
        case FILTER_CONTRAST: {
            float contrast = intensity;
            for (int i = 0; i < pixel_count * 4; i += 4) {
                frame_data[i + 0] = clamp_uint8((frame_data[i + 0] - 128) * (1.0f + contrast) + 128);
                frame_data[i + 1] = clamp_uint8((frame_data[i + 1] - 128) * (1.0f + contrast) + 128);
                frame_data[i + 2] = clamp_uint8((frame_data[i + 2] - 128) * (1.0f + contrast) + 128);
            }
            break;
        }
        
        case FILTER_SATURATION: {
            float sat = intensity;
            for (int i = 0; i < pixel_count * 4; i += 4) {
                uint8_t r = frame_data[i + 0];
                uint8_t g = frame_data[i + 1];
                uint8_t b = frame_data[i + 2];
                
                // Simple saturation adjustment using luminance
                float lum = 0.299f * r + 0.587f * g + 0.114f * b;
                frame_data[i + 0] = clamp_uint8(lum + (r - lum) * (1.0f + sat));
                frame_data[i + 1] = clamp_uint8(lum + (g - lum) * (1.0f + sat));
                frame_data[i + 2] = clamp_uint8(lum + (b - lum) * (1.0f + sat));
            }
            break;
        }
        
        default:
            break;
    }
}