import { HandLandmarkerResult, GestureRecognizerResult } from '@mediapipe/tasks-vision';

export type InferenceResult = HandLandmarkerResult | GestureRecognizerResult;

export interface DetectedHand {
  handedness: string;
  score: number;
  gesture: string;
  gestureScore: number;
  sizeRatio?: number;
  isFullyInFrame?: boolean;
}

export interface TelemetryData {
  fps: number;
  inferenceTime: number;
  doneTime: number;
  handsDetected: number;
  handedness: string;
  gesture: string;
  gestureScore: number;
  detectedHandsList: DetectedHand[];
  streamWidth: number;
  streamHeight: number;
}

export interface ImageProcessedData {
  inferenceTime: number;
  handsDetected: number;
  handedness: string;
  gesture: string;
  gestureScore: number;
  detectedHandsList: DetectedHand[];
}

export interface ResolutionInfo {
  label: string;
  value: '4k' | '2k' | '1080p' | '720p' | '480p' | 'device';
  width?: number;
  height?: number;
}
