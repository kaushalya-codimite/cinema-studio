import React from 'react';
import { videoFileService } from '../../services/videoFileService';
import { useVideoProjectStore } from '../../stores/videoProjectStore';

const Toolbar: React.FC = () => {
  const { project, createNewProject, addVideoFile, addClipToTrack } = useVideoProjectStore();

  const handleImportVideo = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          console.log('Loading video file:', file.name);
          
          // Create a project if none exists
          if (!project) {
            createNewProject('New Project', 1920, 1080, 30);
          }

          // Load video file
          const videoInfo = await videoFileService.loadVideoFile(file);
          console.log('Video loaded:', videoInfo);

          // Add to project
          addVideoFile(videoInfo);
          addClipToTrack(videoInfo, 0); // Add to first video track

        } catch (error) {
          console.error('Failed to import video:', error);
          alert(`Failed to import video: ${error}`);
        }
      }
    };
    input.click();
  };

  const handleNewProject = () => {
    const name = prompt('Project name:', 'New Project') || 'New Project';
    createNewProject(name, 1920, 1080, 30);
  };

  return (
    <div className="toolbar">
      <h1 style={{ 
        fontSize: '20px', 
        fontWeight: '700',
        background: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '1px'
      }}>
        🎬 CinemaStudio Pro
      </h1>
      
      <button className="primary" onClick={handleNewProject}>
        ✨ New Project
      </button>
      
      <button className="secondary" onClick={handleImportVideo}>
        📁 Import Video
      </button>
      
      <button className="success" disabled>
        🚀 Export
      </button>
      
      {project && (
        <div className="status-indicator success">
          ✓ {project.name} | {project.width}x{project.height} @ {project.fps}fps
        </div>
      )}
      
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="status-indicator warning">
          ⚡ WASM + C Powered
        </div>
        <div style={{ fontSize: '11px', color: '#999', fontWeight: '500' }}>
          Professional Video Editor
        </div>
      </div>
    </div>
  );
};

export default Toolbar;