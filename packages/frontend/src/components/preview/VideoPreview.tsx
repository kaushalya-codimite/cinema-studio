import React, { useRef, useEffect, useState } from 'react';
import { videoService } from '../../services/videoService';
import { videoFileService } from '../../services/videoFileService';
import { useVideoProjectStore } from '../../stores/videoProjectStore';
import type { VideoDecoder, VideoFrame } from '../../wasm/video-engine.d.ts';

const VideoPreview: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { project, setCurrentTime, setPlaying } = useVideoProjectStore();
  const [decoder, setDecoder] = useState<VideoDecoder | null>(null);
  const [currentFrame, setCurrentFrame] = useState<VideoFrame | null>(null);
  const [frameNumber, setFrameNumber] = useState(0);
  const [playbackInterval, setPlaybackInterval] = useState<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const initializePreview = async () => {
      try {
        await videoService.initialize();
      } catch (error) {
        console.error('Failed to initialize video service:', error);
      }

      if (project && project.tracks.length > 0) {
        const videoTrack = project.tracks.find(t => t.type === 'video');
        if (videoTrack && videoTrack.clips.length > 0) {
          // Load the first video clip for preview
          const firstClip = videoTrack.clips[0];
          renderVideoAtTime(project.currentTime);
        } else {
          // Initialize with a test pattern if no video loaded
          initializeTestVideo();
        }
      } else {
        initializeTestVideo();
      }
    };

    initializePreview();
  }, [project]);

  // Handle play/pause state changes
  useEffect(() => {
    if (project && project.isPlaying) {
      startPlayback();
    } else {
      stopPlayback();
    }
  }, [project?.isPlaying]);

  // Handle currentTime changes for rendering frames
  useEffect(() => {
    if (project && !project.isPlaying) {
      // Only render when NOT playing (to avoid conflicts with playback timer)
      renderVideoAtTime(project.currentTime);
    }
  }, [project?.currentTime]);

  const startPlayback = () => {
    if (playbackInterval || !project) return;

    console.log('▶️ Starting playback at fps:', project.fps);
    const fps = project.fps;
    const duration = project.duration;
    
    const interval = setInterval(() => {
      // Get fresh project state
      const currentProject = useVideoProjectStore.getState().project;
      if (!currentProject || !currentProject.isPlaying) {
        clearInterval(interval);
        setPlaybackInterval(null);
        return;
      }
      
      const currentTime = currentProject.currentTime;
      const newTime = currentTime + (1 / fps);
      
      if (newTime >= duration) {
        console.log('⏹️ Video ended, stopping playback');
        setPlaying(false);
        setCurrentTime(0);
        clearInterval(interval);
        setPlaybackInterval(null);
      } else {
        setCurrentTime(newTime);
        // Render frame at new time
        renderVideoAtTime(newTime);
      }
    }, 1000 / fps);

    setPlaybackInterval(interval);
  };

  const stopPlayback = () => {
    if (playbackInterval) {
      console.log('⏸️ Stopping playback');
      clearInterval(playbackInterval);
      setPlaybackInterval(null);
    }
  };

  const initializeTestVideo = async () => {
    try {
      await videoService.initialize();
      
      // Skip WASM decoder creation, just draw test pattern
      console.log('Initializing test video in JavaScript mode');
      drawTestPattern();
    } catch (error) {
      console.error('Failed to initialize test video:', error);
      drawTestPattern();
    }
  };

  const drawTestPattern = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set default canvas size
    canvas.width = 1920;
    canvas.height = 1080;

    // Draw test pattern
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 100) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 100) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }
    
    // Draw center text
    ctx.fillStyle = '#fff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CinemaStudio Pro', canvas.width / 2, canvas.height / 2 - 50);
    ctx.font = '24px Arial';
    ctx.fillText('Video Preview Ready', canvas.width / 2, canvas.height / 2);
    ctx.font = '16px Arial';
    ctx.fillText('Import a video file to begin editing', canvas.width / 2, canvas.height / 2 + 30);
  };

  const renderVideoAtTime = async (time: number) => {
    if (!project) return;

    const videoTrack = project.tracks.find(t => t.type === 'video');
    if (!videoTrack || videoTrack.clips.length === 0) return;

    // Find the active clip at the current time
    const activeClip = videoTrack.clips.find(clip => 
      time >= clip.startTime && time <= clip.endTime
    );

    if (activeClip) {
      try {
        // Extract frame from the video file
        const videoTime = time - activeClip.startTime;
        const frame = await videoFileService.extractFrame(activeClip.videoInfo, videoTime);
        
        if (frame) {
          // Apply ALL effects (not just color correction)
          let frameData = videoFileService.convertImageDataToRGBA(frame.imageData);
          const width = frame.imageData.width;
          const height = frame.imageData.height;
          
          // Process all enabled effects in order
          for (const effect of activeClip.effects) {
            if (!effect.enabled) continue;
            
            console.log(`🎨 Applying effect in preview: ${effect.type}`);
            
            switch (effect.type) {
              case 'color_correction':
                try {
                  await applyColorCorrectionWASM(frameData, width, height, effect.parameters as any);
                } catch (error) {
                  console.error('❌ Color correction failed in preview - C/WASM required:', error);
                }
                break;
              case 'transform':
                try {
                  await videoService.initialize();
                  videoService.applyTransform(frameData, width, height, effect.parameters as any);
                  console.log(`🔄 Applied C/WASM transform in preview`);
                } catch (error) {
                  console.error('❌ C/WASM transform failed in preview - C function not implemented yet:', error);
                  console.log('⚠️ Transform skipped - Preview requires C/WASM implementation');
                  // NO JAVASCRIPT FALLBACK - Preview must use C/WASM only
                }
                break;
              case 'blur':
                try {
                  await videoService.initialize();
                  videoService.applyBlurFilter(frameData, width, height, effect.parameters.radius || 1);
                  console.log(`🌫️ Applied WASM blur filter in preview (radius: ${effect.parameters.radius})`);
                } catch (error) {
                  console.error('❌ WASM blur failed in preview:', error);
                }
                break;
              case 'sharpen':
                try {
                  await videoService.initialize();
                  videoService.applySharpenFilter(frameData, width, height, effect.parameters.intensity || 0.5);
                  console.log(`⚡ Applied WASM sharpen filter in preview (intensity: ${effect.parameters.intensity})`);
                } catch (error) {
                  console.error('❌ WASM sharpen failed in preview:', error);
                }
                break;
              case 'noise_reduction':
                try {
                  await videoService.initialize();
                  videoService.applyNoiseReduction(frameData, width, height, effect.parameters.strength || 0.5);
                  console.log(`🔧 Applied WASM noise reduction in preview (strength: ${effect.parameters.strength})`);
                } catch (error) {
                  console.error('❌ WASM noise reduction failed in preview:', error);
                }
                break;
              default:
                console.warn(`❓ Unknown effect type in preview: ${effect.type}`);
            }
          }

          // Draw to canvas
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = frame.imageData.width;
              canvas.height = frame.imageData.height;
              
              try {
                const processedImageData = new ImageData(
                  new Uint8ClampedArray(frameData),
                  frame.imageData.width,
                  frame.imageData.height
                );
                
                ctx.putImageData(processedImageData, 0, 0);
              } catch (error) {
                console.error('Error creating ImageData:', error);
                // Fallback: draw the original image data
                ctx.putImageData(frame.imageData, 0, 0);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to render video at time:', time, error);
        // Show error in canvas
        drawErrorMessage();
      }
    } else {
      // No active clip - show placeholder
      drawTestPattern();
    }
  };

  const applyColorCorrectionWASM = async (frameData: Uint8Array, width: number, height: number, params: any) => {
    // Use C/WASM ONLY for color correction in preview - NO JavaScript fallback
    try {
      await videoService.initialize();
      videoService.applyColorCorrection(frameData, width, height, params);
      console.log('✅ Applied C/WASM color correction in preview');
    } catch (error) {
      console.error('❌ C/WASM color correction failed in preview:', error);
      throw error; // Re-throw to handle at call site
    }
  };


  const drawErrorMessage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 450;

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Error Loading Video Frame', canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.fillText('Check console for details', canvas.width / 2, canvas.height / 2 + 10);
  };

  const loadFrame = (dec: VideoDecoder, frame: number) => {
    // DISABLED: WASM frame loading not available
    console.log('Frame loading disabled - using JavaScript mode');
    drawTestPattern();
  };

  const drawFrameToCanvas = (frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas internal resolution to match frame
    canvas.width = frame.width;
    canvas.height = frame.height;

    // Clear the canvas first
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, frame.width, frame.height);

    try {
      // Create ImageData from frame data
      const imageData = new ImageData(
        new Uint8ClampedArray(frame.data),
        frame.width,
        frame.height
      );

      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Error drawing frame to canvas:', error);
      // Draw a test pattern instead
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, frame.width, frame.height);
      ctx.fillStyle = '#666';
      ctx.fillRect(10, 10, frame.width - 20, frame.height - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Video Frame Error', frame.width / 2, frame.height / 2);
    }
  };

  const handlePlayPause = () => {
    if (project) {
      console.log('🎬 Play button clicked! Current state:', {
        isPlaying: project.isPlaying,
        currentTime: project.currentTime,
        duration: project.duration
      });
      setPlaying(!project.isPlaying);
    }
  };

  const handleTimeSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
  };

  const applyTestFilter = () => {
    if (!project) {
      drawTestPatternWithFilter();
      return;
    }

    // Apply WASM-based test filter to current video frame
    const videoTrack = project.tracks.find(t => t.type === 'video');
    if (videoTrack?.clips.length > 0) {
      // Get current active clip
      const activeClip = videoTrack.clips.find(clip => 
        project.currentTime >= clip.startTime && project.currentTime <= clip.endTime
      );
      
      if (activeClip) {
        // Enable a test brightness effect on the clip
        const effectIndex = activeClip.effects.findIndex(e => e.type === 'color_correction');
        if (effectIndex >= 0) {
          // Update existing effect with test parameters
          activeClip.effects[effectIndex].parameters.brightness = 0.3;
          activeClip.effects[effectIndex].parameters.contrast = 0.2;
          activeClip.effects[effectIndex].enabled = true;
          console.log('🧪 Applied test filter with WASM effects');
        }
      }
      
      // Re-render with WASM effects
      renderVideoAtTime(project.currentTime);
    }
  };

  const drawTestPatternWithFilter = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1920;
    canvas.height = 1080;

    // Draw test pattern with brightness effect
    ctx.fillStyle = '#333333'; // Brighter background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw bright grid
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i += 100) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 100) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }
    
    // Draw center text with bright effect
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Brightness Filter Applied', canvas.width / 2, canvas.height / 2 - 50);
    ctx.font = '24px Arial';
    ctx.fillText('Test Pattern with Enhanced Brightness', canvas.width / 2, canvas.height / 2);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
      <div style={{
        width: '100%',
        maxWidth: '800px',
        aspectRatio: '16/9',
        backgroundColor: '#000',
        border: '1px solid #555',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <canvas
          ref={canvasRef}
          className="video-preview"
          style={{ 
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
        />
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px',
        padding: '16px',
        background: 'linear-gradient(135deg, var(--bg-secondary) 0%, #333 100%)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}>
        <button 
          className={project?.isPlaying ? 'danger' : 'success'}
          onClick={handlePlayPause} 
          disabled={!project}
        >
          {project?.isPlaying ? '⏸️ Pause' : '▶️ Play'}
        </button>
        
        <button 
          className="secondary" 
          onClick={applyTestFilter}
        >
          ✨ Apply WASM Filter
        </button>
        
        {project && (
          <div className="status-indicator success">
            🎥 Video Ready
          </div>
        )}
      </div>
      
      {project && (
        <div style={{ width: '400px' }}>
          <input
            type="range"
            min="0"
            max={project.duration}
            step="0.1"
            value={project.currentTime}
            onChange={handleTimeSeek}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#ccc' }}>
            <span>{project.currentTime.toFixed(1)}s</span>
            <span>{project.duration.toFixed(1)}s</span>
          </div>
          {project.tracks.find(t => t.type === 'video')?.clips.length > 0 && (
            <div style={{ fontSize: '11px', color: '#999', textAlign: 'center', marginTop: '4px' }}>
              Video loaded: {project.tracks.find(t => t.type === 'video')?.clips[0]?.name}
            </div>
          )}
        </div>
      )}

      {/* Fallback for test mode */}
      {decoder && !project && (
        <div style={{ width: '300px' }}>
          <input
            type="range"
            min="0"
            max={decoder.totalFrames - 1}
            value={frameNumber}
            onChange={(e) => {
              const newFrame = parseInt(e.target.value);
              setFrameNumber(newFrame);
              loadFrame(decoder, newFrame);
            }}
          />
          <div style={{ fontSize: '12px', color: '#ccc', textAlign: 'center' }}>
            Frame: {frameNumber} / {decoder.totalFrames - 1} (Test Mode)
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;