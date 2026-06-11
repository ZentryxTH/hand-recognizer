import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, OnChanges, SimpleChanges, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonSpinner } from '@ionic/angular/standalone';
import { HandLandmarkerService } from '../../models/handLandmarkers/handLandmarker.service';
import { GestureRecognizerService } from '../../models/gestureRecognizer/gestureRecognizer.service';

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

  @Output() telemetryUpdate = new EventEmitter<any>();
  @Output() modelLoaded = new EventEmitter<number>();
  @Output() camerasEnumerated = new EventEmitter<MediaDeviceInfo[]>();
  @Output() resolutionsDetected = new EventEmitter<any[]>();

  @ViewChild('videoElement', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasOverlay', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  isLoading = true;
  availableCameras: MediaDeviceInfo[] = [];

  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  // Inference throttling: ~25 FPS inference, 60 FPS draw
  private minInferenceIntervalMs = 40;
  private lastInferenceTimeMs = 0;
  private cachedResults: any = null;

  // Pre-allocated skeleton connection groups
  private readonly HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17] // MCP bridges
  ];

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

  async ngOnChanges(changes: SimpleChanges) {
    const cameraParamsChanged = changes['selectedCameraId'] || changes['isFrontCamera'] || changes['targetResolution'];
    if (cameraParamsChanged && !cameraParamsChanged.firstChange) {
      await this.startCamera();
    }

    const modelParamsChanged = changes['maxHands'] || 
                               changes['minDetectionConfidence'] || 
                               changes['minPresenceConfidence'] || 
                               changes['minTrackingConfidence'] || 
                               changes['delegate'] || 
                               changes['activeMode'];
    if (modelParamsChanged && !modelParamsChanged.firstChange) {
      await this.loadModels();
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

  async loadModels() {
    this.isLoading = true;
    this.stopPredictionLoop();

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
      this.modelLoaded.emit(loadTimeMs);
      this.startPredictionLoop();
    } catch (err) {
      console.error('Failed to configure model options:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async startCamera() {
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

        const list = [
          { label: `Device Default (${curW}x${curH})`, value: 'device', width: curW, height: curH }
        ];

        const standardResolutions = [
          { label: '4K (3840x2160)', value: '4k', width: 3840, height: 2160 },
          { label: '2K (2560x1440)', value: '2k', width: 2560, height: 1440 },
          { label: '1080p (Full HD)', value: '1080p', width: 1920, height: 1080 },
          { label: '720p (HD)', value: '720p', width: 1280, height: 720 },
          { label: '480p (Standard)', value: '480p', width: 640, height: 480 }
        ];

        for (const res of standardResolutions) {
          if (res.width <= maxW && res.height <= maxH) {
            if (res.width !== curW || res.height !== curH) {
              list.push(res);
            }
          }
        }

        this.resolutionsDetected.emit(list);
      }
    } catch (err) {
      console.error('Webcam stream access failed:', err);
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

    this.ngZone.runOutsideAngular(() => {
      const predict = () => {
        const video = this.videoRef.nativeElement;
        const canvas = this.canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');

        if (video.paused && !video.ended) {
          video.play().catch(() => {});
        }

        if (ctx && video.readyState >= 2) {
          const now = performance.now();
          frameCount++;
          if (now - lastTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (now - lastTime));
            frameCount = 0;
            lastTime = now;
          }

          // 1. Calculate cropping dimensions based on the chosen aspect ratio
          let targetRatio = 16 / 9;
          switch (this.selectedAspectRatio) {
            case '16:9': targetRatio = 16 / 9; break;
            case '9:16': targetRatio = 9 / 16; break;
            case '4:3': targetRatio = 4 / 3; break;
            case '3:4': targetRatio = 3 / 4; break;
            case '5:4': targetRatio = 5 / 4; break;
            case '4:5': targetRatio = 4 / 5; break;
            case '1:1': targetRatio = 1 / 1; break;
          }

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
          // Input (FHD) -> 720p -> Model
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

          // 2. Draw cropped video frame onto canvas display at 60 FPS
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.save();
          // Horizontal mirroring in JS to avoid rendering drawn text backwards!
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

            // Inference runs directly on the mirrored and cropped canvas representation (already scaled down to 720p height max)
            if (this.activeMode === 'hand-landmarker') {
              this.cachedResults = this.handService.detectVideoFrame(canvas, startInference);
            } else {
              this.cachedResults = this.gestureService.recognizeVideoFrame(canvas, startInference);
            }

            const inferenceTime = Math.round(performance.now() - startInference);
            const doneTime = Math.round(performance.now() - now);

            this.ngZone.run(() => {
              this.emitTelemetry(fps, inferenceTime, doneTime, this.cachedResults);
            });
          }

          // 4. Draw landmarks directly on top of the display canvas
          if (this.cachedResults) {
            this.drawLandmarks(ctx, this.cachedResults, canvas.width, canvas.height);
            this.drawCategoryLabels(ctx, this.cachedResults, canvas.width, canvas.height);
          }
        }

        this.animationFrameId = window.setTimeout(predict, 16) as any;
      };

      this.animationFrameId = window.setTimeout(predict, 16) as any;
    });
  }

  private stopPredictionLoop() {
    if (this.animationFrameId) {
      window.clearTimeout(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private drawLandmarks(ctx: CanvasRenderingContext2D, results: any, width: number, height: number) {
    if (!results.landmarks) return;

    const canvas = this.canvasRef.nativeElement;
    const clientWidth = canvas.clientWidth || width;
    const scale = width / clientWidth;

    ctx.save();
    ctx.lineWidth = 1.5 * scale;

    for (const landmarks of results.landmarks) {
      // Draw skeleton lines using specified HAND_CONNECTIONS in cyan
      ctx.strokeStyle = '#00f2fe';
      for (const [start, end] of this.HAND_CONNECTIONS) {
        if (landmarks[start] && landmarks[end]) {
          ctx.beginPath();
          ctx.moveTo(landmarks[start].x * width, landmarks[start].y * height);
          ctx.lineTo(landmarks[end].x * width, landmarks[end].y * height);
          ctx.stroke();
        }
      }

      // Draw landmark points
      for (let idx = 0; idx < landmarks.length; idx++) {
        const lm = landmarks[idx];
        if (!lm) continue;
        const x = lm.x * width;
        const y = lm.y * height;

        if (idx === 0) {
          ctx.fillStyle = '#a855f7'; // Wrist: purple
        } else if (idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20) {
          ctx.fillStyle = '#ff2d55'; // Tips: pink
        } else {
          ctx.fillStyle = '#34c759'; // Joints: green
        }

        ctx.beginPath();
        ctx.arc(x, y, 3 * scale, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private emitTelemetry(fps: number, inferenceTime: number, doneTime: number, results: any) {
    const handsDetected = results?.handedness ? results.handedness.length : 0;
    let label = 'N/A';
    let gesture = 'N/A';
    let gestureScore = 0;
    const detectedHandsList: any[] = [];

    if (results?.handedness) {
      for (let i = 0; i < results.handedness.length; i++) {
        const handData = results.handedness[i][0];
        let handLabel = handData.categoryName;
        // Anatomically correct hand swap in front camera mode
        if (this.isFrontCamera) {
          handLabel = handLabel === 'Left' ? 'Right' : 'Left';
        }
        const score = Math.round(handData.score * 100);

        let gName = 'N/A';
        let gScore = 0;
        if (results.gestures && results.gestures[i] && results.gestures[i][0]) {
          gName = results.gestures[i][0].categoryName;
          gScore = Math.round(results.gestures[i][0].score * 100);
        }

        detectedHandsList.push({
          handedness: handLabel,
          score,
          gesture: gName,
          gestureScore: gScore
        });
      }
    }

    const video = this.videoRef?.nativeElement;
    const streamWidth = video ? video.videoWidth : 0;
    const streamHeight = video ? video.videoHeight : 0;

    if (detectedHandsList.length > 0) {
      label = detectedHandsList[0].handedness;
      gesture = detectedHandsList[0].gesture;
      gestureScore = detectedHandsList[0].gestureScore;
    }

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
    switch (this.selectedAspectRatio) {
      case '16:9': return 'ratio-16-9';
      case '9:16': return 'ratio-9-16';
      case '4:3': return 'ratio-4-3';
      case '3:4': return 'ratio-3-4';
      case '5:4': return 'ratio-5-4';
      case '4:5': return 'ratio-4-5';
      case '1:1': return 'ratio-1-1';
      default: return 'ratio-16-9';
    }
  }

  private drawCategoryLabels(ctx: CanvasRenderingContext2D, results: any, width: number, height: number) {
    if (!results.landmarks || !results.handedness) return;

    const canvas = this.canvasRef.nativeElement;
    const clientWidth = canvas.clientWidth || width;
    const scale = width / clientWidth;
    const baseFontSize = clientWidth < 768 ? 16 : 14;
    const fontSize = Math.round(baseFontSize * scale);

    ctx.save();
    ctx.textBaseline = 'top';

    for (let i = 0; i < results.landmarks.length; i++) {
      const landmarks = results.landmarks[i];
      const handedness = results.handedness[i];
      const gesture = results.gestures?.[i];

      const wrist = landmarks?.[0];
      if (!wrist || !handedness) continue;

      // Position text overlay at the wrist (landmark 0)
      const x = wrist.x * width;
      const y = (wrist.y * height) + (15 * scale);

      let handLabel = handedness[0].categoryName;
      // Anatomical flip to align left/right correctly
      if (this.isFrontCamera) {
        handLabel = handLabel === 'Left' ? 'RIGHT' : 'LEFT';
      } else {
        handLabel = handLabel === 'Left' ? 'LEFT' : 'RIGHT';
      }

      const score = Math.round(handedness[0].score * 100);
      let displayText = `${handLabel} ${score}%`;
      if (this.activeMode === 'gesture-recognizer' && gesture?.[0]) {
        displayText += ` - ${gesture[0].categoryName} (${Math.round(gesture[0].score * 100)}%)`;
      }

      ctx.textAlign = 'center';
      ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

      const textHeight = fontSize + (8 * scale);
      const textWidth = ctx.measureText(displayText).width;
      ctx.fillStyle = 'rgba(17, 18, 22, 0.9)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1 * scale;
      this.drawRoundedRect(ctx, x - (textWidth / 2) - (8 * scale), y - (4 * scale), textWidth + (16 * scale), textHeight, 4 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(displayText, x, y);
    }
    ctx.restore();
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
