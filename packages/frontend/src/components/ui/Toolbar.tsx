import React from 'react';
import { videoFileService } from '../../services/videoFileService';
import { useVideoProjectStore } from '../../stores/videoProjectStore';

const Toolbar: React.FC = () => {
  const { 
    project, 
    createNewProject, 
    addVideoFile, 
    addClipToTrack,
    undo,
    redo,
    canUndo,
    canRedo
  } = useVideoProjectStore();

  const handleImportVideo = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true; // Allow multiple file selection
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        try {
          // Create a project if none exists
          if (!project) {
            createNewProject('New Project', 1920, 1080, 30);
          }

          console.log(`Importing ${files.length} video files...`);
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`Loading video ${i + 1}/${files.length}: ${file.name}`);
            
            try {
              // Load video file
              const videoInfo = await videoFileService.loadVideoFile(file);
              console.log('Video loaded:', videoInfo);

              // Add to project
              addVideoFile(videoInfo);
              addClipToTrack(videoInfo, 0); // Add to first video track - will auto-sequence

            } catch (error) {
              console.error(`Failed to load ${file.name}:`, error);
            }
          }
          
          console.log(`✅ Successfully imported ${files.length} video files`);

        } catch (error) {
          console.error('Failed to import videos:', error);
          alert(`Failed to import videos: ${error}`);
        }
      }
    };
    input.click();
  };

  const handleNewProject = () => {
    const name = prompt('Project name:', 'New Project');
    if (name !== null) {
      createNewProject(name || 'New Project', 1920, 1080, 30);
    }
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
        📁 Import Videos
      </button>
      
      <button className="success" disabled>
        🚀 Export
      </button>

      {/* Undo/Redo buttons */}
      <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
        <button 
          className="secondary" 
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            opacity: canUndo() ? 1 : 0.4,
            cursor: canUndo() ? 'pointer' : 'not-allowed'
          }}
          onClick={undo}
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button 
          className="secondary" 
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            opacity: canRedo() ? 1 : 0.4,
            cursor: canRedo() ? 'pointer' : 'not-allowed'
          }}
          onClick={redo}
          disabled={!canRedo()}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
      </div>
      
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