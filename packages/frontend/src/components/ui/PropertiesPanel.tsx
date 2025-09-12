import React, { useState } from 'react';
import { useVideoProjectStore } from '../../stores/videoProjectStore';
import { videoService } from '../../services/videoService';
import { videoFileService } from '../../services/videoFileService';
import type { VideoExporter } from '../../wasm/video-engine.d.ts';

const PropertiesPanel: React.FC = () => {
  const { project, updateClipEffect, addEffectToClip } = useVideoProjectStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  const selectedClip = project?.tracks
    .flatMap(track => track.clips)
    .find(clip => clip.id === project?.selectedClipId);

  const colorEffect = selectedClip?.effects.find(e => e.type === 'color_correction');
  const transformEffect = selectedClip?.effects.find(e => e.type === 'transform');

  const handleEffectChange = (parameter: string, value: number) => {
    if (selectedClip && colorEffect) {
      updateClipEffect(selectedClip.id, colorEffect.id, { [parameter]: value });
    }
  };

  const handleTransformChange = (parameter: string, value: number | boolean) => {
    if (selectedClip && transformEffect) {
      updateClipEffect(selectedClip.id, transformEffect.id, { [parameter]: value });
    }
  };

  const exportVideo = async (format: 'mp4' | 'webm') => {
    if (!project) return;
    
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      console.log(`🚀 Starting ${format.toUpperCase()} export for project: ${project.name}`);
      
      // Import services dynamically
      const { frameExtractionService } = await import('../../services/frameExtractionService');
      
      // Calculate export settings based on project
      const width = 1280;  // Standard HD width
      const height = 720;  // Standard HD height  
      const fps = project.fps;
      
      // Get all clips from all tracks
      const allClips = project.tracks.flatMap(track => track.clips);
      
      // Check if project has clips
      if (!allClips || allClips.length === 0) {
        throw new Error('No clips in project to export');
      }
      
      const duration = Math.max(...allClips.map(clip => clip.startTime + clip.duration));
      
      console.log(`📊 Export settings: ${width}x${height} @ ${fps}fps, duration: ${duration}s`);
      console.log(`📋 Found ${allClips.length} clips across ${project.tracks.length} tracks`);
      
      // Extract frames from all clips in the project
      console.log('🎬 Extracting frames from project...');
      setExportProgress(10);
      
      const frames = await frameExtractionService.extractFramesFromClips(
        allClips,
        { width, height, fps },
        (progress, frameIndex, totalFrames) => {
          const extractProgress = 10 + (progress * 0.6); // 10% to 70% for extraction
          setExportProgress(extractProgress);
          
          if (frameIndex % 30 === 0 || frameIndex === totalFrames) {
            console.log(`📸 Frame extraction: ${frameIndex}/${totalFrames} (${progress.toFixed(1)}%)`);
          }
        }
      );
      
      if (frames.length === 0) {
        throw new Error('No frames extracted from project clips');
      }
      
      console.log(`✅ Extracted ${frames.length} frames, starting video encoding...`);
      setExportProgress(70);
      
      let exportedData: Uint8Array;
      
      try {
        // Try FFmpeg.wasm first (with timeout)
        console.log('🔧 Attempting FFmpeg.wasm export...');
        const { ffmpegExportService } = await import('../../services/ffmpegExportService');
        
        const ffmpegPromise = ffmpegExportService.initialize().then(() =>
          ffmpegExportService.exportVideo(
            frames,
            { format, fps, width, height, quality: 'medium' },
            (progress) => {
              const totalProgress = 70 + (progress * 0.3); // 70% to 100% for encoding
              setExportProgress(totalProgress);
              
              if (progress % 10 === 0 || progress === 100) {
                console.log(`🎥 FFmpeg encoding: ${progress.toFixed(1)}%`);
              }
            }
          )
        );
        
        // Timeout for FFmpeg (5 seconds since it's now local)
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('FFmpeg.wasm loading timeout')), 5000)
        );
        
        exportedData = await Promise.race([ffmpegPromise, timeoutPromise]);
        console.log('✅ FFmpeg.wasm export successful');
        
      } catch (ffmpegError) {
        console.warn('⚠️ FFmpeg.wasm failed, falling back to Canvas MediaRecorder:', ffmpegError);
        
        // Fallback to Canvas MediaRecorder
        const { canvasExportService } = await import('../../services/canvasExportService');
        
        exportedData = await canvasExportService.exportVideo(
          frames,
          { format: 'webm', fps, width, height, quality: 0.8 }, // Force WebM for MediaRecorder
          (progress) => {
            const totalProgress = 70 + (progress * 0.3); // 70% to 100% for encoding
            setExportProgress(totalProgress);
            
            if (progress % 10 === 0 || progress === 100) {
              console.log(`🎥 Canvas encoding: ${progress.toFixed(1)}%`);
            }
          }
        );
        console.log('✅ Canvas MediaRecorder export successful');
      }
      
      if (!exportedData || exportedData.length === 0) {
        throw new Error('Video export returned empty data');
      }
      
      // Create blob and download
      const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';
      const blob = new Blob([exportedData], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      // Create download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name || 'video_export'}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      const fileSizeMB = (exportedData.length / 1024 / 1024).toFixed(2);
      console.log(`✅ ${format.toUpperCase()} export completed! File size: ${fileSizeMB}MB`);
      alert(`${format.toUpperCase()} export completed successfully!\nFile size: ${fileSizeMB}MB\nFrames: ${frames.length}`);
      
    } catch (error) {
      console.error(`❌ ${format.toUpperCase()} export failed:`, error);
      alert(`Export failed: ${error}`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  if (!project) {
    return (
      <div className="properties-panel">
        <div className="panel-section">
          <div style={{ textAlign: 'center', color: '#666' }}>
            No project loaded
          </div>
        </div>
      </div>
    );
  }

  if (!selectedClip) {
    return (
      <div className="properties-panel">
        <div className="panel-section">
          <div style={{ textAlign: 'center', color: '#666' }}>
            Select a clip to edit properties
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="panel-section">
        <h3>Clip: {selectedClip.name}</h3>
        <div style={{ fontSize: '11px', color: '#999', marginBottom: '12px' }}>
          Duration: {selectedClip.duration.toFixed(1)}s
        </div>
      </div>

      {colorEffect && (
        <div className="panel-section">
          <h3>🎨 Color Correction</h3>
          
          <div className="control-group">
            <label>Brightness</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={colorEffect.parameters.brightness || 0}
              onChange={(e) => handleEffectChange('brightness', parseFloat(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>
              {((colorEffect.parameters.brightness || 0) * 100).toFixed(0)}
            </span>
          </div>

          <div className="control-group">
            <label>Contrast</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={colorEffect.parameters.contrast || 0}
              onChange={(e) => handleEffectChange('contrast', parseFloat(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>
              {((colorEffect.parameters.contrast || 0) * 100).toFixed(0)}
            </span>
          </div>

          <div className="control-group">
            <label>Saturation</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={colorEffect.parameters.saturation || 0}
              onChange={(e) => handleEffectChange('saturation', parseFloat(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>
              {((colorEffect.parameters.saturation || 0) * 100).toFixed(0)}
            </span>
          </div>

          <div className="control-group">
            <label>Hue</label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={colorEffect.parameters.hue || 0}
              onChange={(e) => handleEffectChange('hue', parseFloat(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>{colorEffect.parameters.hue || 0}°</span>
          </div>

          <div className="control-group">
            <label>Gamma</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={colorEffect.parameters.gamma || 1}
              onChange={(e) => handleEffectChange('gamma', parseFloat(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>
              {(colorEffect.parameters.gamma || 1).toFixed(1)}
            </span>
          </div>

          <div className="control-group">
            <label>Exposure</label>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={colorEffect.parameters.exposure || 0}
              onChange={(e) => handleEffectChange('exposure', parseFloat(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>
              {(colorEffect.parameters.exposure || 0).toFixed(1)}
            </span>
          </div>
        </div>
      )}

      <div className="panel-section">
        <h3>🎨 WASM Filters</h3>
        <button 
          className="secondary" 
          style={{ width: '100%', marginBottom: '12px' }}
          onClick={async () => {
            if (selectedClip && project) {
              console.log('🌫️ Applying WASM blur filter...');
              try {
                await videoService.initialize();
                
                const videoTrack = project.tracks.find(t => t.type === 'video');
                if (videoTrack) {
                  const activeClip = videoTrack.clips.find(clip => 
                    project.currentTime >= clip.startTime && project.currentTime <= clip.endTime
                  );
                  
                  if (activeClip) {
                    const videoTime = project.currentTime - activeClip.startTime;
                    const frame = await videoFileService.extractFrame(activeClip.videoInfo, videoTime);
                    
                    if (frame) {
                      let frameData = videoFileService.convertImageDataToRGBA(frame.imageData);
                      videoService.applyBlurFilter(frameData, frame.imageData.width, frame.imageData.height, 3.0);
                      
                      // Update canvas display with filtered result
                      const canvas = document.querySelector('canvas');
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          const processedImageData = new ImageData(
                            new Uint8ClampedArray(frameData),
                            frame.imageData.width,
                            frame.imageData.height
                          );
                          ctx.putImageData(processedImageData, 0, 0);
                          console.log('✅ WASM blur filter applied and canvas updated!');
                        }
                      }
                      
                      // Add blur effect persistently to the selected clip for export
                      if (selectedClip) {
                        addEffectToClip(selectedClip.id, 'blur', { radius: 3.0 });
                        console.log('✅ Blur effect added to clip for export!');
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('❌ WASM blur filter failed:', error);
              }
            }
          }}
        >
          🌫️ Blur (WASM)
        </button>
        <button 
          className="secondary" 
          style={{ width: '100%', marginBottom: '12px' }}
          onClick={async () => {
            if (selectedClip && project) {
              console.log('⚡ Applying WASM sharpen filter...');
              try {
                await videoService.initialize();
                
                const videoTrack = project.tracks.find(t => t.type === 'video');
                if (videoTrack) {
                  const activeClip = videoTrack.clips.find(clip => 
                    project.currentTime >= clip.startTime && project.currentTime <= clip.endTime
                  );
                  
                  if (activeClip) {
                    const videoTime = project.currentTime - activeClip.startTime;
                    const frame = await videoFileService.extractFrame(activeClip.videoInfo, videoTime);
                    
                    if (frame) {
                      let frameData = videoFileService.convertImageDataToRGBA(frame.imageData);
                      videoService.applySharpenFilter(frameData, frame.imageData.width, frame.imageData.height, 0.5);
                      
                      // Update canvas display with filtered result
                      const canvas = document.querySelector('canvas');
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          const processedImageData = new ImageData(
                            new Uint8ClampedArray(frameData),
                            frame.imageData.width,
                            frame.imageData.height
                          );
                          ctx.putImageData(processedImageData, 0, 0);
                          console.log('✅ WASM sharpen filter applied and canvas updated!');
                        }
                      }
                      
                      // Add sharpen effect persistently to the selected clip for export
                      if (selectedClip) {
                        addEffectToClip(selectedClip.id, 'sharpen', { intensity: 0.5 });
                        console.log('✅ Sharpen effect added to clip for export!');
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('❌ WASM sharpen filter failed:', error);
              }
            }
          }}
        >
          ⚡ Sharpen (WASM)
        </button>
        <button 
          className="secondary" 
          style={{ width: '100%', marginBottom: '12px' }}
          onClick={async () => {
            if (selectedClip && project) {
              console.log('🔧 Applying WASM noise reduction...');
              try {
                await videoService.initialize();
                
                const videoTrack = project.tracks.find(t => t.type === 'video');
                if (videoTrack) {
                  const activeClip = videoTrack.clips.find(clip => 
                    project.currentTime >= clip.startTime && project.currentTime <= clip.endTime
                  );
                  
                  if (activeClip) {
                    const videoTime = project.currentTime - activeClip.startTime;
                    const frame = await videoFileService.extractFrame(activeClip.videoInfo, videoTime);
                    
                    if (frame) {
                      let frameData = videoFileService.convertImageDataToRGBA(frame.imageData);
                      videoService.applyNoiseReduction(frameData, frame.imageData.width, frame.imageData.height, 0.8);
                      
                      // Update canvas display with filtered result
                      const canvas = document.querySelector('canvas');
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          const processedImageData = new ImageData(
                            new Uint8ClampedArray(frameData),
                            frame.imageData.width,
                            frame.imageData.height
                          );
                          ctx.putImageData(processedImageData, 0, 0);
                          console.log('✅ WASM noise reduction applied and canvas updated!');
                        }
                      }
                      
                      // Add noise reduction effect persistently to the selected clip for export
                      if (selectedClip) {
                        addEffectToClip(selectedClip.id, 'noise_reduction', { strength: 0.8 });
                        console.log('✅ Noise reduction effect added to clip for export!');
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('❌ WASM noise reduction failed:', error);
              }
            }
          }}
        >
          🔧 Noise Reduction (C)
        </button>
      </div>

      {transformEffect && (
        <div className="panel-section">
          <h3>🔄 Transform</h3>
          
          <div className="control-group">
            <label>Scale</label>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={transformEffect.parameters.scale || 100}
              onChange={(e) => handleTransformChange('scale', parseFloat(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>
              {(transformEffect.parameters.scale || 100)}%
            </span>
          </div>

          <div className="control-group">
            <label>Rotation</label>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={transformEffect.parameters.rotation || 0}
              onChange={(e) => handleTransformChange('rotation', parseFloat(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>
              {(transformEffect.parameters.rotation || 0)}°
            </span>
          </div>

          <div className="control-group">
            <label>Flip</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={transformEffect.parameters.flipHorizontal ? 'primary' : 'secondary'}
                style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                onClick={() => handleTransformChange('flipHorizontal', !transformEffect.parameters.flipHorizontal)}
              >
                ↔️ Horizontal
              </button>
              <button
                className={transformEffect.parameters.flipVertical ? 'primary' : 'secondary'}
                style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                onClick={() => handleTransformChange('flipVertical', !transformEffect.parameters.flipVertical)}
              >
                ↕️ Vertical
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>Crop Position</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px' }}>X</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={transformEffect.parameters.cropX || 0}
                  onChange={(e) => handleTransformChange('cropX', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '10px', color: '#999' }}>{transformEffect.parameters.cropX || 0}%</span>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px' }}>Y</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={transformEffect.parameters.cropY || 0}
                  onChange={(e) => handleTransformChange('cropY', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '10px', color: '#999' }}>{transformEffect.parameters.cropY || 0}%</span>
              </div>
            </div>
          </div>

          <div className="control-group">
            <label>Crop Size</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px' }}>Width</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={transformEffect.parameters.cropWidth || 100}
                  onChange={(e) => handleTransformChange('cropWidth', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '10px', color: '#999' }}>{transformEffect.parameters.cropWidth || 100}%</span>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px' }}>Height</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={transformEffect.parameters.cropHeight || 100}
                  onChange={(e) => handleTransformChange('cropHeight', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '10px', color: '#999' }}>{transformEffect.parameters.cropHeight || 100}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="panel-section">
        <h3>🚀 Export</h3>
        
        {isExporting && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ 
              width: '100%', 
              height: '6px', 
              backgroundColor: '#333', 
              borderRadius: '3px', 
              overflow: 'hidden' 
            }}>
              <div style={{
                width: `${exportProgress}%`,
                height: '100%',
                backgroundColor: '#4a90e2',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: '11px', color: '#999', textAlign: 'center', marginTop: '4px' }}>
              Exporting... {exportProgress.toFixed(1)}%
            </div>
          </div>
        )}
        
        <button 
          className="success" 
          style={{ width: '100%', marginBottom: '12px' }} 
          disabled={isExporting || !project}
          onClick={() => exportVideo('mp4')}
        >
          📹 {isExporting ? 'Exporting...' : 'Export MP4 (WASM)'}
        </button>
        <button 
          className="success" 
          style={{ width: '100%', marginBottom: '12px' }} 
          disabled={isExporting || !project}
          onClick={() => exportVideo('webm')}
        >
          🎬 {isExporting ? 'Exporting...' : 'Export WebM (WASM)'}
        </button>
        <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
          {isExporting 
            ? 'Processing video frames with WASM + C...' 
            : 'Full video export with all applied effects'
          }
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;