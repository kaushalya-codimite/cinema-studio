import React, { useState, useEffect } from 'react';
import VideoPreview from './components/preview/VideoPreview';
import Timeline from './components/timeline/Timeline';
import PropertiesPanel from './components/ui/PropertiesPanel';
import Toolbar from './components/ui/Toolbar';
import { videoService } from './services/videoService';
import { videoFileService } from './services/videoFileService';
import { useVideoProjectStore } from './stores/videoProjectStore';

function App() {
  const [isEngineLoaded, setIsEngineLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  
  const { project, createNewProject, addVideoFile, addClipToTrack } = useVideoProjectStore();

  useEffect(() => {
    const initializeEngine = async () => {
      try {
        setIsLoading(true);
        await videoService.initialize();
        setIsEngineLoaded(true);
        console.log('CinemaStudio Pro initialized!');
        console.log('Engine version:', videoService.getVersion());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize video engine');
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeEngine();
  }, []);

  // Handle multiple video file processing
  const processVideoFiles = async (files: FileList) => {
    if (!isEngineLoaded) return;
    
    setIsProcessingFiles(true);
    try {
      // Create a project if none exists
      if (!project) {
        createNewProject('New Project', 1920, 1080, 30);
      }

      const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));
      
      if (videoFiles.length === 0) {
        alert('No video files found in the selection.');
        return;
      }

      console.log(`Processing ${videoFiles.length} video files...`);
      
      let currentPosition = 0;
      
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        console.log(`Loading video ${i + 1}/${videoFiles.length}: ${file.name}`);
        
        try {
          // Load video file
          const videoInfo = await videoFileService.loadVideoFile(file);
          console.log('Video loaded:', videoInfo);

          // Add to project
          addVideoFile(videoInfo);
          
          // Add to timeline at current position
          const videoTrack = project?.tracks.find(t => t.type === 'video');
          if (videoTrack) {
            // Create clip with position offset for sequential arrangement
            addClipToTrack(videoInfo, 0);
            currentPosition += videoInfo.duration;
          }
        } catch (error) {
          console.error(`Failed to load ${file.name}:`, error);
        }
      }
      
      console.log(`✅ Successfully processed ${videoFiles.length} video files`);
      
    } catch (error) {
      console.error('Error processing files:', error);
      alert(`Error processing files: ${error}`);
    } finally {
      setIsProcessingFiles(false);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processVideoFiles(files);
    }
  };

  if (isLoading) {
    return (
      <div className="video-editor">
        <div className="main-content">
          <div className="preview-area">
            <div className="loading">Loading CinemaStudio Pro...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-editor">
        <div className="main-content">
          <div className="preview-area">
            <div className="error">Error: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`video-editor ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Toolbar />
      <div className="main-content">
        <div className="preview-area">
          <VideoPreview />
        </div>
        <PropertiesPanel />
      </div>
      <div className="timeline-area">
        <Timeline />
      </div>
      
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="drag-drop-overlay">
          <div className="drag-drop-content">
            <div className="drag-drop-icon">📁</div>
            <h2>Drop Video Files Here</h2>
            <p>Support multiple files - they will be added as sequential clips</p>
          </div>
        </div>
      )}
      
      {/* File Processing Overlay */}
      {isProcessingFiles && (
        <div className="processing-overlay">
          <div className="processing-content">
            <div className="loading-spinner"></div>
            <h2>Processing Video Files...</h2>
            <p>Please wait while we load your clips</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;