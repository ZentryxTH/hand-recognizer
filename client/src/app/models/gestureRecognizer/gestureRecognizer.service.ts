import { Injectable } from '@angular/core';
import { FilesetResolver, GestureRecognizer, GestureRecognizerResult } from '@mediapipe/tasks-vision';

export interface GestureRecognizerConfig {
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
export class GestureRecognizerService {
  private recognizer: GestureRecognizer | null = null;
  private currentRunningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';
  private currentDelegate: 'GPU' | 'CPU' = 'GPU';
  private initPromise: Promise<{ recognizer: GestureRecognizer | null; loadTimeMs: number }> | null = null;

  async initialize(config: GestureRecognizerConfig): Promise<{ recognizer: GestureRecognizer | null; loadTimeMs: number }> {
    const targetRunningMode = config.runningMode || 'VIDEO';

    // If model already exists and delegate/mode is compatible, just update settings dynamically
    if (this.recognizer && this.currentDelegate === config.delegate && this.currentRunningMode === targetRunningMode) {
      try {
        this.recognizer.setOptions({
          numHands: config.numHands,
          minHandDetectionConfidence: config.minHandDetectionConfidence,
          minHandPresenceConfidence: config.minHandPresenceConfidence,
          minTrackingConfidence: config.minTrackingConfidence
        });
        return { recognizer: this.recognizer, loadTimeMs: 0 };
      } catch (err) {
        console.warn('Failed to dynamically set GestureRecognizer options, falling back to full load:', err);
      }
    }

    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
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

  private async loadModel(config: GestureRecognizerConfig): Promise<{ recognizer: GestureRecognizer | null; loadTimeMs: number }> {
    const startTime = performance.now();
    this.currentRunningMode = config.runningMode || 'VIDEO';
    this.currentDelegate = config.delegate;

    try {
      const wasmFileset = {
        wasmLoaderPath: 'assets/wasm/vision_wasm_internal.js',
        wasmBinaryPath: 'assets/wasm/vision_wasm_internal.wasm'
      };

      this.recognizer = await GestureRecognizer.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: 'assets/models/mediapipe/gesture_recognizer.task',
          delegate: config.delegate
        },
        runningMode: this.currentRunningMode,
        numHands: config.numHands,
        minHandDetectionConfidence: config.minHandDetectionConfidence,
        minHandPresenceConfidence: config.minHandPresenceConfidence,
        minTrackingConfidence: config.minTrackingConfidence
      });

      const loadTimeMs = Math.round(performance.now() - startTime);
      return { recognizer: this.recognizer, loadTimeMs };
    } catch (err) {
      console.error('Failed to load GestureRecognizer:', err);
      return { recognizer: null, loadTimeMs: 0 };
    }
  }

  /**
   * VIDEO mode: Call this with a live video element and monotonic timestamp.
   */
  recognizeVideoFrame(video: HTMLVideoElement | HTMLCanvasElement, timestamp: number): GestureRecognizerResult | null {
    if (!this.recognizer) return null;
    try {
      return this.recognizer.recognizeForVideo(video, timestamp);
    } catch (err) {
      console.error('Inference error in GestureRecognizer:', err);
      return null;
    }
  }

  /**
   * IMAGE mode: Call this for single static image recognition.
   * Requires the model to be initialized with runningMode: 'IMAGE'.
   */
  recognizeImage(image: HTMLCanvasElement | HTMLImageElement): GestureRecognizerResult | null {
    if (!this.recognizer) return null;
    try {
      return this.recognizer.recognize(image);
    } catch (err) {
      console.error('Static recognition error in GestureRecognizer:', err);
      return null;
    }
  }

  close() {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
  }
}
