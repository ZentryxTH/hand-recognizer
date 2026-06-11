import { Injectable } from '@angular/core';
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';

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
  private visionTasksResolver: any = null;
  private recognizer: GestureRecognizer | null = null;
  private currentRunningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';
  private initPromise: Promise<{ recognizer: GestureRecognizer | null; loadTimeMs: number }> | null = null;

  initialize(config: GestureRecognizerConfig): Promise<{ recognizer: GestureRecognizer | null; loadTimeMs: number }> {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadModel(config);
    return this.initPromise.finally(() => {
      this.initPromise = null;
    });
  }

  private async loadModel(config: GestureRecognizerConfig): Promise<{ recognizer: GestureRecognizer | null; loadTimeMs: number }> {
    const startTime = performance.now();
    this.currentRunningMode = config.runningMode || 'VIDEO';

    try {
      if (!this.visionTasksResolver) {
        this.visionTasksResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );
      }

      this.recognizer = await GestureRecognizer.createFromOptions(this.visionTasksResolver, {
        baseOptions: {
          modelAssetPath: 'assets/models/gesture_recognizer.task',
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
  recognizeVideoFrame(video: HTMLVideoElement | HTMLCanvasElement, timestamp: number): any {
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
  recognizeImage(image: HTMLCanvasElement | HTMLImageElement): any {
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
