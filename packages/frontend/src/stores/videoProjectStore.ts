import { create } from 'zustand';
import type { VideoFileInfo } from '../services/videoFileService';

export interface VideoClip {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  trackIndex: number;
  videoInfo: VideoFileInfo;
  effects: VideoEffect[];
}

export interface VideoEffect {
  id: string;
  type: 'color_correction' | 'blur' | 'sharpen' | 'noise_reduction';
  enabled: boolean;
  parameters: Record<string, number>;
}

export interface VideoTrack {
  id: string;
  type: 'video' | 'audio';
  clips: VideoClip[];
  muted: boolean;
  volume: number;
}

export interface VideoProject {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  tracks: VideoTrack[];
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  timelineZoom: number; // 1.0 = normal, 2.0 = 200% zoom, 0.5 = 50% zoom
  timelineScrollOffset: number; // Horizontal scroll position in seconds
}

interface VideoProjectStore {
  project: VideoProject | null;
  loadedVideos: VideoFileInfo[];
  
  // Actions
  createNewProject: (name: string, width: number, height: number, fps: number) => void;
  addVideoFile: (videoInfo: VideoFileInfo) => void;
  removeVideoFile: (videoId: string) => void;
  addClipToTrack: (videoInfo: VideoFileInfo, trackIndex: number, position?: number) => void;
  removeClip: (clipId: string) => void;
  selectClip: (clipId: string | null) => void;
  updateClipEffect: (clipId: string, effectId: string, parameters: Record<string, number>) => void;
  addEffectToClip: (clipId: string, effectType: string, parameters?: Record<string, number>) => void;
  clearFiltersFromClip: (clipId: string) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setTimelineZoom: (zoom: number) => void;
  setTimelineScrollOffset: (offset: number) => void;
  updateClipTiming: (clipId: string, startTime: number, endTime: number) => void;
}

export const useVideoProjectStore = create<VideoProjectStore>((set, get) => ({
  project: null,
  loadedVideos: [],

  createNewProject: (name, width, height, fps) => {
    const newProject: VideoProject = {
      id: Date.now().toString(),
      name,
      width,
      height,
      fps,
      duration: 60, // Default 60 seconds
      tracks: [
        {
          id: 'video-track-1',
          type: 'video',
          clips: [],
          muted: false,
          volume: 1.0
        },
        {
          id: 'audio-track-1',
          type: 'audio',
          clips: [],
          muted: false,
          volume: 1.0
        }
      ],
      currentTime: 0,
      isPlaying: false,
      selectedClipId: null,
      timelineZoom: 1.0,
      timelineScrollOffset: 0
    };

    set({ project: newProject });
  },

  addVideoFile: (videoInfo) => {
    set((state) => ({
      loadedVideos: [...state.loadedVideos, videoInfo]
    }));
  },

  removeVideoFile: (videoId) => {
    set((state) => ({
      loadedVideos: state.loadedVideos.filter(v => v.name !== videoId)
    }));
  },

  addClipToTrack: (videoInfo, trackIndex, position?: number) => {
    const { project } = get();
    if (!project || trackIndex >= project.tracks.length) return;

    const track = project.tracks[trackIndex];
    let startTime = position ?? 0;
    
    // If no position specified, add after the last clip
    if (position === undefined && track.clips.length > 0) {
      const lastClip = track.clips.reduce((latest, clip) => 
        clip.endTime > latest.endTime ? clip : latest
      );
      startTime = lastClip.endTime;
    }

    const newClip: VideoClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: videoInfo.name,
      startTime,
      endTime: startTime + videoInfo.duration,
      duration: videoInfo.duration,
      trackIndex,
      videoInfo,
      effects: [
        {
          id: 'color-correction',
          type: 'color_correction',
          enabled: true,
          parameters: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            hue: 0,
            gamma: 1,
            exposure: 0
          }
        },
        {
          id: 'transform',
          type: 'transform',
          enabled: true,
          parameters: {
            scale: 100,
            rotation: 0,
            flipHorizontal: false,
            flipVertical: false,
            cropX: 0,
            cropY: 0,
            cropWidth: 100,
            cropHeight: 100
          }
        }
      ]
    };

    set((state) => ({
      project: state.project ? {
        ...state.project,
        tracks: state.project.tracks.map((track, index) => 
          index === trackIndex 
            ? { ...track, clips: [...track.clips, newClip] }
            : track
        ),
        duration: Math.max(state.project.duration, newClip.endTime)
      } : null
    }));
  },

  removeClip: (clipId) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(clip => clip.id !== clipId)
        })),
        selectedClipId: state.project.selectedClipId === clipId ? null : state.project.selectedClipId
      } : null
    }));
  },

  selectClip: (clipId) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        selectedClipId: clipId
      } : null
    }));
  },

  updateClipEffect: (clipId, effectId, parameters) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => 
            clip.id === clipId 
              ? {
                  ...clip,
                  effects: clip.effects.map(effect =>
                    effect.id === effectId
                      ? { ...effect, parameters: { ...effect.parameters, ...parameters } }
                      : effect
                  )
                }
              : clip
          )
        }))
      } : null
    }));
  },

  addEffectToClip: (clipId, effectType, parameters = {}) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => 
            clip.id === clipId 
              ? {
                  ...clip,
                  effects: [
                    ...clip.effects,
                    {
                      id: `${effectType}-${Date.now()}`,
                      type: effectType,
                      enabled: true,
                      parameters
                    }
                  ]
                }
              : clip
          )
        }))
      } : null
    }));
  },

  clearFiltersFromClip: (clipId) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => 
            clip.id === clipId 
              ? {
                  ...clip,
                  effects: clip.effects.filter(effect => 
                    effect.type === 'color_correction' || effect.type === 'transform'
                  )
                }
              : clip
          )
        }))
      } : null
    }));
  },

  setCurrentTime: (time) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        currentTime: Math.max(0, Math.min(time, state.project.duration))
      } : null
    }));
  },

  setPlaying: (playing) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        isPlaying: playing
      } : null
    }));
  },

  setTimelineZoom: (zoom) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        timelineZoom: Math.max(0.1, Math.min(10, zoom)) // Clamp between 0.1x and 10x
      } : null
    }));
  },

  setTimelineScrollOffset: (offset) => {
    const { project } = get();
    if (!project) return;
    
    set((state) => ({
      project: state.project ? {
        ...state.project,
        timelineScrollOffset: Math.max(0, Math.min(offset, state.project.duration))
      } : null
    }));
  },

  updateClipTiming: (clipId, startTime, endTime) => {
    set((state) => ({
      project: state.project ? {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => 
            clip.id === clipId 
              ? {
                  ...clip,
                  startTime: Math.max(0, startTime),
                  endTime: Math.max(startTime + 0.1, endTime), // Minimum 0.1s duration
                  duration: Math.max(0.1, endTime - startTime)
                }
              : clip
          )
        })),
        duration: Math.max(
          state.project.duration,
          state.project.tracks.reduce((maxTime, track) => 
            Math.max(maxTime, ...track.clips.map(clip => 
              clip.id === clipId ? endTime : clip.endTime
            )), 0)
        )
      } : null
    }));
  }
}));