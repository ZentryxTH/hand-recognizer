import { Injectable } from '@angular/core';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

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
  private landmarker: HandLandmarker | null = null;
  private currentRunningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';
  private currentDelegate: 'GPU' | 'CPU' = 'GPU';

  // Single Promise cache to prevent race conditions during parallel loading
  private initPromise: Promise<{ landmarker: HandLandmarker | null; loadTimeMs: number }> | null = null;

  async initialize(config: HandLandmarkerConfig): Promise<{ landmarker: HandLandmarker | null; loadTimeMs: number }> {
    const targetRunningMode = config.runningMode || 'VIDEO';

    // If model already exists and delegate/mode is compatible, just update settings dynamically
    if (this.landmarker && this.currentDelegate === config.delegate && this.currentRunningMode === targetRunningMode) {
      try {
        this.landmarker.setOptions({
          numHands: config.numHands,
          minHandDetectionConfidence: config.minHandDetectionConfidence,
          minHandPresenceConfidence: config.minHandPresenceConfidence,
          minTrackingConfidence: config.minTrackingConfidence
        });
        return { landmarker: this.landmarker, loadTimeMs: 0 };
      } catch (err) {
        console.warn('Failed to dynamically set HandLandmarker options, falling back to full load:', err);
      }
    }

    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
      this.initPromise = null;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadModel(config);
    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async loadModel(config: HandLandmarkerConfig): Promise<{ landmarker: HandLandmarker | null; loadTimeMs: number }> {
    const startTime = performance.now();
    this.currentRunningMode = config.runningMode || 'VIDEO';
    this.currentDelegate = config.delegate;

    try {
      const wasmFileset = {
        wasmLoaderPath: 'assets/wasm/vision_wasm_internal.js',
        wasmBinaryPath: 'assets/wasm/vision_wasm_internal.wasm'
      };

      this.landmarker = await HandLandmarker.createFromOptions(wasmFileset, {
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
  detectVideoFrame(video: HTMLVideoElement | HTMLCanvasElement, timestamp: number): HandLandmarkerResult | null {
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
  detectImage(image: HTMLCanvasElement | HTMLImageElement): HandLandmarkerResult | null {
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
