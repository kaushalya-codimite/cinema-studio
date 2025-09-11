import React, { useState, useEffect } from 'react';
import VideoPreview from './components/preview/VideoPreview';
import Timeline from './components/timeline/Timeline';
import PropertiesPanel from './components/ui/PropertiesPanel';
import Toolbar from './components/ui/Toolbar';
import { videoService } from './services/videoService';

function App() {
  const [isEngineLoaded, setIsEngineLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="video-editor">
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
    </div>
  );
}

export default App;