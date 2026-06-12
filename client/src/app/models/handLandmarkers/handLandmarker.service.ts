import { Injectable } from '@angular/core';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export interface HandLandmarkerConfig {
  delegate: 'GPU' | 'CPU';
  numHands: number;
  minHandDetectionConfidence: number;
  minHandPresenceConfidence: number;
  minTrackingConfidence: number;
  runningMode?: 'VIDEO' | 'IMAGE';
}

@Injectable({
  providedIn: 'root'
})
export class HandLandmarkerService {
  private visionTasksResolver: any = null;
  private landmarker: HandLandmarker | null = null;
  private currentRunningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';

  // Single Promise cache to prevent race conditions during parallel loading
  private initPromise: Promise<{ landmarker: HandLandmarker | null; loadTimeMs: number }> | null = null;

  initialize(config: HandLandmarkerConfig): Promise<{ landmarker: HandLandmarker | null; loadTimeMs: number }> {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadModel(config);
    return this.initPromise.finally(() => {
      this.initPromise = null;
    });
  }

  private async loadModel(config: HandLandmarkerConfig): Promise<{ landmarker: HandLandmarker | null; loadTimeMs: number }> {
    const startTime = performance.now();
    this.currentRunningMode = config.runningMode || 'VIDEO';

    try {
      if (!this.visionTasksResolver) {
        this.visionTasksResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );
      }

      this.landmarker = await HandLandmarker.createFromOptions(this.visionTasksResolver, {
        baseOptions: {
          modelAssetPath: 'assets/models/mediapipe/hand_landmarker.task',
          delegate: config.delegate
        },
        runningMode: this.currentRunningMode,
        numHands: config.numHands,
        minHandDetectionConfidence: config.minHandDetectionConfidence,
        minHandPresenceConfidence: config.minHandPresenceConfidence,
        minTrackingConfidence: config.minTrackingConfidence
      });

      const loadTimeMs = Math.round(performance.now() - startTime);
      return { landmarker: this.landmarker, loadTimeMs };
    } catch (err) {
      console.error('Failed to load HandLandmarker:', err);
      return { landmarker: null, loadTimeMs: 0 };
    }
  }

  /**
   * VIDEO mode: Call this with a live video element and monotonic timestamp.
   * The timestamp MUST be strictly increasing between calls.
   */
  detectVideoFrame(video: HTMLVideoElement | HTMLCanvasElement, timestamp: number): any {
    if (!this.landmarker) return null;
    try {
      return this.landmarker.detectForVideo(video, timestamp);
    } catch (err) {
      console.error('Inference error in HandLandmarker:', err);
      return null;
    }
  }

  /**
   * IMAGE mode: Call this for single static image detection.
   * Requires the model to be initialized with runningMode: 'IMAGE'.
   */
  detectImage(image: HTMLCanvasElement | HTMLImageElement): any {
    if (!this.landmarker) return null;
    try {
      return this.landmarker.detect(image);
    } catch (err) {
      console.error('Static detection error in HandLandmarker:', err);
      return null;
    }
  }

  close() {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}
