// Video file import and processing service
export interface VideoFileInfo {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  videoElement: HTMLVideoElement;
}

export interface ExtractedFrame {
  frameNumber: number;
  timestamp: number;
  imageData: ImageData;
}

export class VideoFileService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    // Create offscreen canvas for frame extraction
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  async loadVideoFile(file: File): Promise<VideoFileInfo> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        try {
          const videoInfo: VideoFileInfo = {
            name: file.name,
            size: file.size,
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            fps: 30, // Default, will be estimated
            totalFrames: Math.floor(video.duration * 30), // Estimate
            videoElement: video
          };

          resolve(videoInfo);
        } catch (error) {
          reject(new Error(`Failed to load video metadata: ${error}`));
        }
      };

      video.onerror = () => {
        reject(new Error('Failed to load video file'));
      };

      // Create blob URL for the video
      const url = URL.createObjectURL(file);
      video.src = url;
    });
  }

  async extractFrame(videoInfo: VideoFileInfo, timestamp: number): Promise<ExtractedFrame | null> {
    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not initialized');
    }

    return new Promise((resolve, reject) => {
      const video = videoInfo.videoElement;
      
      video.currentTime = timestamp;
      
      video.onseeked = () => {
        try {
          // Set canvas size to match video
          this.canvas!.width = video.videoWidth;
          this.canvas!.height = video.videoHeight;

          // Draw video frame to canvas
          this.ctx!.drawImage(video, 0, 0);

          // Extract image data
          const imageData = this.ctx!.getImageData(0, 0, video.videoWidth, video.videoHeight);
          
          const frameNumber = Math.floor(timestamp * videoInfo.fps);
          
          resolve({
            frameNumber,
            timestamp,
            imageData
          });
        } catch (error) {
          reject(new Error(`Failed to extract frame: ${error}`));
        }
      };

      video.onerror = () => {
        reject(new Error('Video seek error'));
      };
    });
  }

  async extractFrameSequence(
    videoInfo: VideoFileInfo, 
    startTime: number, 
    endTime: number, 
    interval: number = 1/30
  ): Promise<ExtractedFrame[]> {
    const frames: ExtractedFrame[] = [];
    
    for (let timestamp = startTime; timestamp <= endTime; timestamp += interval) {
      try {
        const frame = await this.extractFrame(videoInfo, Math.min(timestamp, videoInfo.duration));
        if (frame) {
          frames.push(frame);
        }
      } catch (error) {
        console.warn(`Failed to extract frame at ${timestamp}s:`, error);
      }
    }

    return frames;
  }

  convertImageDataToRGBA(imageData: ImageData): Uint8Array {
    // ImageData is already in RGBA format
    return new Uint8Array(imageData.data);
  }

  estimateFrameRate(videoInfo: VideoFileInfo, sampleDuration: number = 1.0): Promise<number> {
    return new Promise((resolve) => {
      const video = videoInfo.videoElement;
      let frameCount = 0;
      let lastTime = -1;

      const checkFrame = () => {
        const currentTime = video.currentTime;
        if (currentTime !== lastTime) {
          frameCount++;
          lastTime = currentTime;
        }

        if (currentTime < sampleDuration) {
          requestAnimationFrame(checkFrame);
        } else {
          const estimatedFps = frameCount / sampleDuration;
          resolve(Math.round(estimatedFps));
        }
      };

      video.currentTime = 0;
      video.play();
      requestAnimationFrame(checkFrame);
    });
  }

  generateThumbnails(videoInfo: VideoFileInfo, count: number = 10): Promise<string[]> {
    const thumbnails: string[] = [];
    const interval = videoInfo.duration / count;

    const generateThumbnail = (timestamp: number): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (!this.canvas || !this.ctx) {
          reject(new Error('Canvas not initialized'));
          return;
        }

        const video = videoInfo.videoElement;
        video.currentTime = timestamp;

        video.onseeked = () => {
          try {
            // Set canvas size for thumbnail (scaled down)
            const thumbWidth = 160;
            const thumbHeight = (video.videoHeight / video.videoWidth) * thumbWidth;
            
            this.canvas!.width = thumbWidth;
            this.canvas!.height = thumbHeight;

            this.ctx!.drawImage(video, 0, 0, thumbWidth, thumbHeight);
            
            const thumbnailDataURL = this.canvas!.toDataURL('image/jpeg', 0.8);
            resolve(thumbnailDataURL);
          } catch (error) {
            reject(error);
          }
        };
      });
    };

    return Promise.all(
      Array.from({ length: count }, (_, i) => generateThumbnail(i * interval))
    );
  }

  cleanup(videoInfo: VideoFileInfo) {
    if (videoInfo.videoElement.src) {
      URL.revokeObjectURL(videoInfo.videoElement.src);
    }
  }
}

export const videoFileService = new VideoFileService();