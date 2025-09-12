import React, { useRef, useEffect, useState } from 'react';
import { useVideoProjectStore } from '../../stores/videoProjectStore';

const Timeline: React.FC = () => {
  const { 
    project, 
    selectClip, 
    setTimelineZoom, 
    setTimelineScrollOffset,
    setCurrentTime,
    updateClipTiming
  } = useVideoProjectStore();
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'trim-start' | 'trim-end' | null;
    clipId: string | null;
    startMouseX: number;
    startClipTime: number;
    startClipDuration: number;
  }>({
    type: null,
    clipId: null,
    startMouseX: 0,
    startClipTime: 0,
    startClipDuration: 0
  });

  // Handle zoom controls
  const handleZoomIn = () => {
    if (project) {
      setTimelineZoom(project.timelineZoom * 1.5);
    }
  };

  const handleZoomOut = () => {
    if (project) {
      setTimelineZoom(project.timelineZoom / 1.5);
    }
  };

  const handleResetZoom = () => {
    if (project) {
      setTimelineZoom(1.0);
      setTimelineScrollOffset(0);
    }
  };

  // Handle timeline click for scrubbing
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!project || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineWidth = rect.width;
    
    // Calculate visible duration based on zoom
    const visibleDuration = project.duration / project.timelineZoom;
    const clickTime = project.timelineScrollOffset + (clickX / timelineWidth) * visibleDuration;
    
    setCurrentTime(Math.max(0, Math.min(clickTime, project.duration)));
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!project || !e.ctrlKey) return;
    
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    setTimelineZoom(project.timelineZoom * zoomDelta);
  };

  // Handle clip manipulation
  const handleClipMouseDown = (e: React.MouseEvent, clipId: string, dragType: 'move' | 'trim-start' | 'trim-end') => {
    if (!project || !timelineRef.current) return;
    
    e.stopPropagation();
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clip = project.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
    if (!clip) return;
    
    setIsDragging(true);
    setDragState({
      type: dragType,
      clipId,
      startMouseX: e.clientX - rect.left,
      startClipTime: clip.startTime,
      startClipDuration: clip.duration
    });
  };

  // Handle mouse move during drag
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !project || !timelineRef.current || dragState.type === null) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const currentMouseX = e.clientX - rect.left;
    const deltaX = currentMouseX - dragState.startMouseX;
    
    const visibleDuration = project.duration / project.timelineZoom;
    const timePerPixel = visibleDuration / rect.width;
    const deltaTime = deltaX * timePerPixel;
    
    const clip = project.tracks.flatMap(t => t.clips).find(c => c.id === dragState.clipId);
    if (!clip) return;
    
    let newStartTime = dragState.startClipTime;
    let newEndTime = dragState.startClipTime + dragState.startClipDuration;
    
    switch (dragState.type) {
      case 'move':
        newStartTime = Math.max(0, dragState.startClipTime + deltaTime);
        newEndTime = newStartTime + dragState.startClipDuration;
        break;
        
      case 'trim-start':
        newStartTime = Math.max(0, Math.min(dragState.startClipTime + deltaTime, clip.endTime - 0.1));
        break;
        
      case 'trim-end':
        newEndTime = Math.max(clip.startTime + 0.1, dragState.startClipTime + dragState.startClipDuration + deltaTime);
        break;
    }
    
    updateClipTiming(dragState.clipId, newStartTime, newEndTime);
  };

  // Handle mouse up (end drag)
  const handleMouseUp = () => {
    setIsDragging(false);
    setDragState({
      type: null,
      clipId: null,
      startMouseX: 0,
      startClipTime: 0,
      startClipDuration: 0
    });
  };

  // Global mouse move and up listeners
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!timelineRef.current) return;
        handleMouseMove(e as any);
      };
      
      const handleGlobalMouseUp = () => {
        handleMouseUp();
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragState, project]);

  if (!project) {
    return (
      <div style={{ height: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Create a new project or import a video to get started
        </div>
      </div>
    );
  }

  // Calculate visible timeline parameters
  const visibleDuration = project.duration / project.timelineZoom;
  const visibleStartTime = project.timelineScrollOffset;
  const visibleEndTime = Math.min(project.timelineScrollOffset + visibleDuration, project.duration);

  return (
    <div style={{ height: '100%', padding: '16px' }}>
      {/* Timeline Header with Zoom Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '12px' 
      }}>
        <div style={{ fontSize: '14px', color: '#ccc' }}>
          Timeline - {project.name}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleZoomOut}
            style={{
              padding: '4px 8px',
              backgroundColor: '#444',
              border: '1px solid #666',
              borderRadius: '3px',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Zoom Out (Ctrl + Mouse Wheel)"
          >
            🔍-
          </button>
          
          <span style={{ fontSize: '11px', color: '#999', minWidth: '60px', textAlign: 'center' }}>
            {Math.round(project.timelineZoom * 100)}%
          </span>
          
          <button
            onClick={handleZoomIn}
            style={{
              padding: '4px 8px',
              backgroundColor: '#444',
              border: '1px solid #666',
              borderRadius: '3px',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Zoom In (Ctrl + Mouse Wheel)"
          >
            🔍+
          </button>
          
          <button
            onClick={handleResetZoom}
            style={{
              padding: '4px 8px',
              backgroundColor: '#444',
              border: '1px solid #666',
              borderRadius: '3px',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Reset Zoom"
          >
            ↻
          </button>
        </div>
      </div>
      
      {/* Timeline Container */}
      <div style={{ 
        minHeight: '80px', 
        backgroundColor: '#333', 
        border: '1px solid #555',
        borderRadius: '4px',
        position: 'relative',
        marginBottom: '12px',
        padding: '8px',
        overflow: 'hidden'
      }}
      ref={timelineRef}
      onClick={handleTimelineClick}
      onWheel={handleWheel}
      >
        {project.tracks.map((track, trackIndex) => (
          <div key={track.id} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
              {track.type === 'video' ? '🎥' : '🎵'} {track.type.toUpperCase()} Track {trackIndex + 1}
            </div>
            <div style={{
              height: '24px',
              backgroundColor: '#222',
              border: '1px solid #444',
              borderRadius: '2px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {track.clips.map((clip) => {
                // Calculate clip position relative to visible timeline
                const clipStartVisible = clip.startTime - visibleStartTime;
                const clipEndVisible = clip.endTime - visibleStartTime;
                
                // Only render clips that are at least partially visible
                if (clip.endTime < visibleStartTime || clip.startTime > visibleEndTime) {
                  return null;
                }
                
                const clipWidth = ((clip.endTime - clip.startTime) / visibleDuration) * 100;
                const clipLeft = Math.max(0, (clipStartVisible / visibleDuration) * 100);
                
                const isSelected = project.selectedClipId === clip.id;
                const isDraggingThis = isDragging && dragState.clipId === clip.id;

                return (
                  <div
                    key={clip.id}
                    style={{
                      position: 'absolute',
                      left: `${clipLeft}%`,
                      width: `${clipWidth}%`,
                      height: '100%',
                      backgroundColor: track.type === 'video' ? '#4a90e2' : '#5cb85c',
                      borderRadius: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '10px',
                      color: 'white',
                      cursor: isDraggingThis ? 'grabbing' : 'grab',
                      border: isSelected ? '2px solid #fff' : 'none',
                      opacity: isDraggingThis ? 0.8 : 1,
                      transform: isDraggingThis ? 'scale(1.02)' : 'none',
                      transition: isDraggingThis ? 'none' : 'all 0.1s ease',
                      overflow: 'hidden'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectClip(clip.id);
                    }}
                    onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'move')}
                    title={`${clip.name} - ${clip.startTime.toFixed(1)}s to ${clip.endTime.toFixed(1)}s`}
                  >
                    {/* Left trim handle */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '0',
                        top: '0',
                        bottom: '0',
                        width: '6px',
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        cursor: 'ew-resize',
                        display: isSelected ? 'block' : 'none',
                        borderRadius: '2px 0 0 2px'
                      }}
                      onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'trim-start')}
                      title="Drag to trim start"
                    >
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '2px',
                        height: '60%',
                        backgroundColor: 'white',
                        borderRadius: '1px'
                      }} />
                    </div>

                    {/* Clip content */}
                    <div style={{ 
                      flex: 1, 
                      padding: '0 8px', 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0
                    }}>
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        fontSize: '9px',
                        fontWeight: '500'
                      }}>
                        {clip.name}
                      </span>
                    </div>

                    {/* Right trim handle */}
                    <div
                      style={{
                        position: 'absolute',
                        right: '0',
                        top: '0',
                        bottom: '0',
                        width: '6px',
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        cursor: 'ew-resize',
                        display: isSelected ? 'block' : 'none',
                        borderRadius: '0 2px 2px 0'
                      }}
                      onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'trim-end')}
                      title="Drag to trim end"
                    >
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '2px',
                        height: '60%',
                        backgroundColor: 'white',
                        borderRadius: '1px'
                      }} />
                    </div>
                  </div>
                );
              })}
              
              {/* Playhead */}
              {project.currentTime >= visibleStartTime && project.currentTime <= visibleEndTime && (
                <div style={{
                  position: 'absolute',
                  left: `${((project.currentTime - visibleStartTime) / visibleDuration) * 100}%`,
                  top: '-4px',
                  bottom: '-4px',
                  width: '2px',
                  backgroundColor: '#ff4444',
                  pointerEvents: 'none',
                  zIndex: 10
                }} />
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Timeline Info and Scroll Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ color: '#ccc' }}>Duration: {project.duration.toFixed(1)}s</div>
          <div style={{ color: '#ccc' }}>FPS: {project.fps}</div>
          <div style={{ color: '#ccc' }}>Resolution: {project.width}x{project.height}</div>
          <div style={{ color: '#ccc' }}>
            Clips: {project.tracks.reduce((total, track) => total + track.clips.length, 0)}
          </div>
        </div>
        
        {/* Scroll Controls - only show when zoomed */}
        {project.timelineZoom > 1.0 && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              onClick={() => setTimelineScrollOffset(Math.max(0, project.timelineScrollOffset - visibleDuration * 0.1))}
              style={{
                padding: '2px 6px',
                backgroundColor: '#444',
                border: '1px solid #666',
                borderRadius: '2px',
                color: '#ccc',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="Scroll Left"
            >
              ◀
            </button>
            
            <span style={{ fontSize: '10px', color: '#999' }}>
              {visibleStartTime.toFixed(1)}s - {visibleEndTime.toFixed(1)}s
            </span>
            
            <button
              onClick={() => setTimelineScrollOffset(Math.min(project.duration - visibleDuration, project.timelineScrollOffset + visibleDuration * 0.1))}
              style={{
                padding: '2px 6px',
                backgroundColor: '#444',
                border: '1px solid #666',
                borderRadius: '2px',
                color: '#ccc',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="Scroll Right"
            >
              ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Timeline;