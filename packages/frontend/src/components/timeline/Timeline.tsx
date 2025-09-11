import React from 'react';
import { useVideoProjectStore } from '../../stores/videoProjectStore';

const Timeline: React.FC = () => {
  const { project, selectClip } = useVideoProjectStore();

  if (!project) {
    return (
      <div style={{ height: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Create a new project or import a video to get started
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', padding: '16px' }}>
      <div style={{ marginBottom: '12px', fontSize: '14px', color: '#ccc' }}>
        Timeline - {project.name}
      </div>
      
      <div style={{ 
        minHeight: '80px', 
        backgroundColor: '#333', 
        border: '1px solid #555',
        borderRadius: '4px',
        position: 'relative',
        marginBottom: '12px',
        padding: '8px'
      }}>
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
                const clipWidth = (clip.duration / project.duration) * 100;
                const clipLeft = (clip.startTime / project.duration) * 100;
                
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
                      paddingLeft: '4px',
                      fontSize: '10px',
                      color: 'white',
                      cursor: 'pointer',
                      border: project.selectedClipId === clip.id ? '2px solid #fff' : 'none'
                    }}
                    onClick={() => selectClip(clip.id)}
                    title={clip.name}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {clip.name}
                    </span>
                  </div>
                );
              })}
              
              {/* Playhead */}
              <div style={{
                position: 'absolute',
                left: `${(project.currentTime / project.duration) * 100}%`,
                top: '-4px',
                bottom: '-4px',
                width: '2px',
                backgroundColor: '#ff4444',
                pointerEvents: 'none',
                zIndex: 10
              }} />
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
        <div style={{ color: '#ccc' }}>Duration: {project.duration.toFixed(1)}s</div>
        <div style={{ color: '#ccc' }}>FPS: {project.fps}</div>
        <div style={{ color: '#ccc' }}>Resolution: {project.width}x{project.height}</div>
        <div style={{ color: '#ccc' }}>
          Clips: {project.tracks.reduce((total, track) => total + track.clips.length, 0)}
        </div>
      </div>
    </div>
  );
};

export default Timeline;