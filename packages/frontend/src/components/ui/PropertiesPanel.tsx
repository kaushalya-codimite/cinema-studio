import React from 'react';
import { useVideoProjectStore } from '../../stores/videoProjectStore';

const PropertiesPanel: React.FC = () => {
  const { project, updateClipEffect } = useVideoProjectStore();
  
  const selectedClip = project?.tracks
    .flatMap(track => track.clips)
    .find(clip => clip.id === project?.selectedClipId);

  const colorEffect = selectedClip?.effects.find(e => e.type === 'color_correction');

  const handleEffectChange = (parameter: string, value: number) => {
    if (selectedClip && colorEffect) {
      updateClipEffect(selectedClip.id, colorEffect.id, { [parameter]: value });
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
          onClick={() => {
            if (selectedClip) {
              console.log('🌫️ WASM Blur Filter - WASM processing required');
              // Note: Actual blur filter requires frame pointer from WASM decoder
            }
          }}
        >
          🌫️ Blur (WASM)
        </button>
        <button 
          className="secondary" 
          style={{ width: '100%', marginBottom: '12px' }}
          onClick={() => {
            if (selectedClip) {
              console.log('⚡ WASM Sharpen Filter - WASM processing required');
              // Note: Actual sharpen filter requires frame pointer from WASM decoder
            }
          }}
        >
          ⚡ Sharpen (WASM)
        </button>
        <button 
          className="secondary" 
          style={{ width: '100%', marginBottom: '12px' }}
          onClick={() => {
            if (selectedClip) {
              console.log('🔧 WASM Noise Reduction - C algorithm required');
              // Note: Advanced noise reduction is implemented in C/WASM
            }
          }}
        >
          🔧 Noise Reduction (C)
        </button>
      </div>

      <div className="panel-section">
        <h3>🔄 Transform</h3>
        <div className="control-group">
          <label>Scale</label>
          <input type="range" min="10" max="200" defaultValue="100" />
        </div>
        <div className="control-group">
          <label>Rotation</label>
          <input type="range" min="-180" max="180" defaultValue="0" />
        </div>
      </div>

      <div className="panel-section">
        <h3>🚀 Export</h3>
        <button className="success" style={{ width: '100%', marginBottom: '12px' }} disabled>
          📹 Export MP4
        </button>
        <button className="success" style={{ width: '100%', marginBottom: '12px' }} disabled>
          🎬 Export WebM
        </button>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
          Export functionality coming soon
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;