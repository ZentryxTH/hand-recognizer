import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, OnChanges, SimpleChanges, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonSpinner } from '@ionic/angular/standalone';
import { HandLandmarkerService } from '../../models/handLandmarkers/handLandmarker.service';
import { GestureRecognizerService } from '../../models/gestureRecognizer/gestureRecognizer.service';
import { parseAspectRatio, getAspectRatioClass } from '../../utils/aspect-ratio.utils';
import { drawLandmarks, drawCategoryLabels } from '../../utils/drawing.utils';
import { TelemetryData, ResolutionInfo } from '../../models/telemetry.interface';
import { extractHandTelemetry } from '../../utils/telemetry.utils';

@Component({
  selector: 'app-video-panel',
  templateUrl: './videoPanel.component.html',
  styleUrls: ['./videoPanel.component.scss'],
  standalone: true,
  imports: [CommonModule, IonSpinner]
})
export class VideoPanelComponent implements OnInit, OnDestroy, OnChanges {
  @Input() activeMode: 'hand-landmarker' | 'gesture-recognizer' = 'hand-landmarker';
  @Input() maxHands = 2;
  @Input() minDetectionConfidence = 0.5;
  @Input() minPresenceConfidence = 0.5;
  @Input() minTrackingConfidence = 0.5;
  @Input() delegate: 'GPU' | 'CPU' = 'GPU';

  @Input() selectedCameraId: string | null = null;
  @Input() isFrontCamera = true;
  @Input() targetResolution: '4k' | '2k' | '1080p' | '720p' | '480p' | 'device' = '1080p'; // Default to 1080p (Full HD)
  @Input() selectedAspectRatio: '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1' = '16:9';

  @Output() telemetryUpdate = new EventEmitter<TelemetryData>();
  @Output() modelLoaded = new EventEmitter<number>();
  @Output() camerasEnumerated = new EventEmitter<MediaDeviceInfo[]>();
  @Output() resolutionsDetected = new EventEmitter<ResolutionInfo[]>();

  @ViewChild('videoElement', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasOverlay', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  isLoading = true;
  errorMessage: string | null = null;
  availableCameras: MediaDeviceInfo[] = [];

  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  // Inference throttling: ~25 FPS inference, 60 FPS draw
  private minInferenceIntervalMs = 40;
  private lastInferenceTimeMs = 0;
  private lastTelemetryEmitTimeMs = 0;
  private lastHandsDetectedCount = 0;
  private cachedResults: any = null;

  private pendingCameraLoad: Promise<void> | null = null;
  private pendingModelLoad: Promise<void> | null = null;

  constructor(
    private handService: HandLandmarkerService,
    private gestureService: GestureRecognizerService,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    await this.enumerateCameras();
    await this.startCamera();
    await this.loadModels();
  }

  ngOnChanges(changes: SimpleChanges) {
    const cameraKeys = ['selectedCameraId', 'isFrontCamera', 'targetResolution'];
    const cameraParamsChanged = cameraKeys.some(key => changes[key] && !changes[key].firstChange);

    if (cameraParamsChanged) {
      this.pendingCameraLoad = (this.pendingCameraLoad || Promise.resolve())
        .then(() => this.startCamera());
    }

    const modelKeys = ['maxHands', 'minDetectionConfidence', 'minPresenceConfidence', 'minTrackingConfidence', 'delegate', 'activeMode'];
    const modelParamsChanged = modelKeys.some(key => changes[key] && !changes[key].firstChange);

    if (modelParamsChanged) {
      const onlySlidersChanged = !changes['delegate'] && !changes['activeMode'];
      this.pendingModelLoad = (this.pendingModelLoad || Promise.resolve())
        .then(() => this.loadModels(onlySlidersChanged));
    }
  }

  ngOnDestroy() {
    this.stopCamera();
    this.stopPredictionLoop();
    this.handService.close();
    this.gestureService.close();
  }

  async enumerateCameras() {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableCameras = devices.filter(d => d.kind === 'videoinput');
      this.camerasEnumerated.emit(this.availableCameras);
    } catch (err) {
      console.warn('Could not enumerate camera list:', err);
    }
  }

  async loadModels(onlySliders = false) {
    this.errorMessage = null;
    if (!onlySliders) {
      this.isLoading = true;
      this.stopPredictionLoop();
    }

    const config = {
      delegate: this.delegate,
      numHands: this.maxHands,
      minHandDetectionConfidence: this.minDetectionConfidence,
      minHandPresenceConfidence: this.minPresenceConfidence,
      minTrackingConfidence: this.minTrackingConfidence,
      runningMode: 'VIDEO' as const
    };

    try {
      let loadTimeMs = 0;
      if (this.activeMode === 'hand-landmarker') {
        const res = await this.handService.initialize(config);
        loadTimeMs = res.loadTimeMs;
      } else {
        const res = await this.gestureService.initialize(config);
        loadTimeMs = res.loadTimeMs;
      }

      if (!onlySliders) {
        this.modelLoaded.emit(loadTimeMs);
        this.startPredictionLoop();
      }
    } catch (err) {
      console.error('Failed to configure model options:', err);
      this.errorMessage = 'Failed to load MediaPipe models. Please check your network connection.';
    } finally {
      if (!onlySliders) {
        this.isLoading = false;
      }
    }
  }

  async startCamera() {
    this.errorMessage = null;
    this.stopCamera();
    try {
      const constraints: any = {
        audio: false,
        video: {}
      };

      if (this.targetResolution !== 'device') {
        let videoWidth = 1280;
        let videoHeight = 720;

        if (this.targetResolution === '4k') {
          videoWidth = 3840; videoHeight = 2160;
        } else if (this.targetResolution === '2k') {
          videoWidth = 2560; videoHeight = 1440;
        } else if (this.targetResolution === '1080p') {
          videoWidth = 1920; videoHeight = 1080;
        } else if (this.targetResolution === '480p') {
          videoWidth = 640; videoHeight = 480;
        }

        constraints.video.width = { ideal: videoWidth };
        constraints.video.height = { ideal: videoHeight };
      }

      if (this.selectedCameraId) {
        constraints.video.deviceId = { exact: this.selectedCameraId };
      } else {
        constraints.video.facingMode = this.isFrontCamera ? 'user' : 'environment';
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoRef.nativeElement.srcObject = this.stream;

      // Detect track settings and capabilities to determine supported resolutions
      const track = this.stream.getVideoTracks()[0];
      if (track) {
        let maxW = 1920;
        let maxH = 1080;

        if (typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities();
          if (caps.width && caps.width.max) maxW = caps.width.max;
          if (caps.height && caps.height.max) maxH = caps.height.max;
        }

        const settings = track.getSettings();
        const curW = settings.width || 1280;
        const curH = settings.height || 720;

        // Ensure bounds are at least the negotiated native resolution
        if (curW > maxW) maxW = curW;
        if (curH > maxH) maxH = curH;

        const list: ResolutionInfo[] = [
          { label: `Device Default (${curW}x${curH})`, value: 'device', width: curW, height: curH }
        ];

        const standardResolutions: ResolutionInfo[] = [
          { label: '4K (3840x2160)', value: '4k', width: 3840, height: 2160 },
          { label: '2K (2560x1440)', value: '2k', width: 2560, height: 1440 },
          { label: '1080p (Full HD)', value: '1080p', width: 1920, height: 1080 },
          { label: '720p (HD)', value: '720p', width: 1280, height: 720 },
          { label: '480p (Standard)', value: '480p', width: 640, height: 480 }
        ];

        for (const res of standardResolutions) {
          if (res.width !== undefined && res.height !== undefined && res.width <= maxW && res.height <= maxH) {
            if (res.width !== curW || res.height !== curH) {
              list.push(res);
            }
          }
        }

        this.resolutionsDetected.emit(list);
      }
    } catch (err) {
      console.error('Webcam stream access failed:', err);
      this.errorMessage = 'Webcam stream access failed. Please ensure camera permissions are granted.';
    }
  }

  private stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  private startPredictionLoop() {
    this.stopPredictionLoop();

    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 0;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.ngZone.runOutsideAngular(() => {
      const predict = () => {
        const video = this.videoRef.nativeElement;

        if (video.paused && !video.ended) {
          video.play().catch(() => {});
        }

        if (video.readyState >= 2) {
          const now = performance.now();
          frameCount++;
          if (now - lastTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (now - lastTime));
            frameCount = 0;
            lastTime = now;
          }

          // 1. Calculate cropping dimensions based on the chosen aspect ratio
          const targetRatio = parseAspectRatio(this.selectedAspectRatio);

          const vidW = video.videoWidth;
          const vidH = video.videoHeight;
          const vidRatio = vidW / vidH;

          let sx = 0, sy = 0, sw = vidW, sh = vidH;

          if (vidRatio > targetRatio) {
            sw = vidH * targetRatio;
            sh = vidH;
            sx = (vidW - sw) / 2;
          } else {
            sw = vidW;
            sh = vidW / targetRatio;
            sy = (vidH - sh) / 2;
          }

          // Scale crop region to target limit (720p max height) to minimize prediction latency
          let destW = sw;
          let destH = sh;
          const targetHeight = 720;
          if (sh > targetHeight) {
            const scale = targetHeight / sh;
            destW = Math.round(sw * scale);
            destH = targetHeight;
          }

          if (canvas.width !== destW || canvas.height !== destH) {
            canvas.width = destW;
            canvas.height = destH;
          }

          // 2. Draw cropped video frame onto canvas display
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.save();
          if (this.isFrontCamera) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // 3. Only run model inference if the throttle interval has elapsed (~25 FPS)
          if (now - this.lastInferenceTimeMs >= this.minInferenceIntervalMs) {
            this.lastInferenceTimeMs = now;

            const startInference = performance.now();

            if (this.activeMode === 'hand-landmarker') {
              this.cachedResults = this.handService.detectVideoFrame(canvas, startInference);
            } else {
              this.cachedResults = this.gestureService.recognizeVideoFrame(canvas, startInference);
            }

            const inferenceTime = Math.round(performance.now() - startInference);
            const doneTime = Math.round(performance.now() - now);

            // Throttle telemetry updates to reduce change detection cycles
            const handsCount = this.cachedResults?.handedness?.length || 0;
            const handsChanged = handsCount !== this.lastHandsDetectedCount;
            this.lastHandsDetectedCount = handsCount;

            const shouldEmit = handsChanged || (now - this.lastTelemetryEmitTimeMs >= 200);
            if (shouldEmit) {
              this.lastTelemetryEmitTimeMs = now;
              this.ngZone.run(() => {
                this.emitTelemetry(fps, inferenceTime, doneTime, this.cachedResults);
              });
            }
          }

          // 4. Draw landmarks directly on top of the display canvas
          if (this.cachedResults) {
            drawLandmarks(ctx, this.cachedResults, canvas.width, canvas.height);
            drawCategoryLabels(ctx, this.cachedResults, canvas.width, canvas.height, this.activeMode, this.isFrontCamera);
          }
        }

        this.animationFrameId = requestAnimationFrame(predict);
      };

      this.animationFrameId = requestAnimationFrame(predict);
    });
  }

  private stopPredictionLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private emitTelemetry(fps: number, inferenceTime: number, doneTime: number, results: any) {
    const detectedHandsList = extractHandTelemetry(results, this.isFrontCamera);
    const handsDetected = detectedHandsList.length;
    let label = 'N/A';
    let gesture = 'N/A';
    let gestureScore = 0;

    if (detectedHandsList.length > 0) {
      label = detectedHandsList[0].handedness;
      gesture = detectedHandsList[0].gesture;
      gestureScore = detectedHandsList[0].gestureScore;
    }

    const video = this.videoRef?.nativeElement;
    const streamWidth = video ? video.videoWidth : 0;
    const streamHeight = video ? video.videoHeight : 0;

    this.telemetryUpdate.emit({
      fps,
      inferenceTime,
      doneTime,
      handsDetected,
      handedness: label,
      gesture,
      gestureScore,
      detectedHandsList,
      streamWidth,
      streamHeight
    });
  }

  getRatioClass(): string {
    return getAspectRatioClass(this.selectedAspectRatio);
  }
}
