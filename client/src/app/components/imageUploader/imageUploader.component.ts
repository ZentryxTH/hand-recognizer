import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon, IonSpinner, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudUploadOutline, imageOutline, cropOutline, resizeOutline, arrowRedoOutline, arrowUndoOutline } from 'ionicons/icons';
import { HandLandmarkerService } from '../../models/handLandmarkers/handLandmarker.service';
import { GestureRecognizerService } from '../../models/gestureRecognizer/gestureRecognizer.service';

export interface ImageMetadata {
  name: string;
  size: string;
  type: string;
  originalResolution: string;
  processedResolution: string;
  rotation: number;
}

@Component({
  selector: 'app-image-uploader',
  templateUrl: './imageUploader.component.html',
  styleUrls: ['./imageUploader.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonButton, IonIcon, IonSpinner, IonLabel
  ]
})
export class ImageUploaderComponent implements OnChanges {
  @Input() activeMode: 'hand-landmarker' | 'gesture-recognizer' = 'hand-landmarker';
  @Input() maxHands = 2;
  @Input() minDetectionConfidence = 0.5;
  @Input() minPresenceConfidence = 0.5;
  @Input() minTrackingConfidence = 0.5;
  @Input() delegate: 'GPU' | 'CPU' = 'GPU';

  @Input() selectedAspectRatio: 'original' | '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1' = 'original';
  @Input() targetResolution: 'original' | '4k' | '2k' | '1080p' | '720p' | '480p' = '720p';
  @Input() rotationDegrees = 0;

  @Output() imageProcessed = new EventEmitter<any>();
  @Output() metadataExtracted = new EventEmitter<ImageMetadata>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasOverlay') canvasRef!: ElementRef<HTMLCanvasElement>;

  imageSrc: string | null = null;
  isLoading = false;
  metadata: ImageMetadata | null = null;

  private loadedImage: HTMLImageElement | null = null;

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
    private gestureService: GestureRecognizerService
  ) {
    addIcons({ cloudUploadOutline, imageOutline, cropOutline, resizeOutline, arrowRedoOutline, arrowUndoOutline });
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (this.loadedImage && (
      changes['selectedAspectRatio'] ||
      changes['targetResolution'] ||
      changes['rotationDegrees'] ||
      changes['activeMode'] ||
      changes['maxHands'] ||
      changes['minDetectionConfidence'] ||
      changes['minPresenceConfidence'] ||
      changes['minTrackingConfidence'] ||
      changes['delegate']
    )) {
      await this.applyImageSettingsAndProcess();
    }
  }

  triggerSelect() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isLoading = true;
    const reader = new FileReader();

    reader.onload = (e: any) => {
      this.imageSrc = e.target.result;

      const img = new Image();
      img.onload = () => {
        this.loadedImage = img;
        this.applyImageSettingsAndProcess();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  private async applyImageSettingsAndProcess() {
    if (!this.loadedImage || !this.imageSrc) return;

    this.isLoading = true;
    const img = this.loadedImage;
    const file = this.fileInput.nativeElement.files?.[0];
    const fileSizeStr = file ? this.formatBytes(file.size) : 'Unknown size';
    const fileType = file ? file.type : 'image/jpeg';
    const fileName = file ? file.name : 'upload.jpg';

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.isLoading = false;
      return;
    }

    const origW = img.naturalWidth;
    const origH = img.naturalHeight;

    // 1. Create a temporary canvas containing the fully rotated upright image
    const is90or270 = this.rotationDegrees === 90 || this.rotationDegrees === 270;
    const rotW = is90or270 ? origH : origW;
    const rotH = is90or270 ? origW : origH;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rotW;
    tempCanvas.height = rotH;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      this.isLoading = false;
      return;
    }

    tempCtx.translate(rotW / 2, rotH / 2);
    tempCtx.rotate((this.rotationDegrees * Math.PI) / 180);
    tempCtx.drawImage(img, -origW / 2, -origH / 2, origW, origH);

    // 2. Calculate crop box parameters on the rotated upright image
    let sx = 0, sy = 0, sw = rotW, sh = rotH;

    if (this.selectedAspectRatio !== 'original') {
      let targetRatio = 1;
      if (this.selectedAspectRatio === '16:9') targetRatio = 16 / 9;
      else if (this.selectedAspectRatio === '9:16') targetRatio = 9 / 16;
      else if (this.selectedAspectRatio === '4:3') targetRatio = 4 / 3;
      else if (this.selectedAspectRatio === '3:4') targetRatio = 3 / 4;
      else if (this.selectedAspectRatio === '5:4') targetRatio = 5 / 4;
      else if (this.selectedAspectRatio === '4:5') targetRatio = 4 / 5;
      else if (this.selectedAspectRatio === '1:1') targetRatio = 1;

      const rotRatio = rotW / rotH;
      if (rotRatio > targetRatio) {
        sw = rotH * targetRatio;
        sh = rotH;
        sx = (rotW - sw) / 2;
      } else {
        sw = rotW;
        sh = rotW / targetRatio;
        sy = (rotH - sh) / 2;
      }
    }

    // 3. Scale the cropped image region based on target resolution selection
    let targetW = sw;
    let targetH = sh;

    if (this.targetResolution !== 'original') {
      let limit = 720;
      if (this.targetResolution === '4k') limit = 2160;
      else if (this.targetResolution === '2k') limit = 1440;
      else if (this.targetResolution === '1080p') limit = 1080;
      else if (this.targetResolution === '480p') limit = 480;

      const maxDim = Math.max(sw, sh);
      if (maxDim > limit) {
        const scale = limit / maxDim;
        targetW = sw * scale;
        targetH = sh * scale;
      }
    }

    targetW = Math.round(targetW);
    targetH = Math.round(targetH);

    // 4. Configure active output canvas dimensions and draw the final region
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, sx, sy, sw, sh, 0, 0, targetW, targetH);

    // 5. Update Metadata representation
    this.metadata = {
      name: fileName,
      size: fileSizeStr,
      type: fileType,
      originalResolution: `${origW}x${origH}`,
      processedResolution: `${canvas.width}x${canvas.height}`,
      rotation: this.rotationDegrees
    };
    this.metadataExtracted.emit(this.metadata);

    // 6. Execute model inference on output canvas using IMAGE running mode
    const config = {
      delegate: this.delegate,
      numHands: this.maxHands,
      minHandDetectionConfidence: this.minDetectionConfidence,
      minHandPresenceConfidence: this.minPresenceConfidence,
      minTrackingConfidence: this.minTrackingConfidence,
      runningMode: 'IMAGE' as const  // IMAGE mode for static detection
    };

    try {
      let results: any = null;
      const startTime = performance.now();

      if (this.activeMode === 'hand-landmarker') {
        const { landmarker } = await this.handService.initialize(config);
        if (landmarker) {
          results = this.handService.detectImage(canvas);
        }
      } else {
        const { recognizer } = await this.gestureService.initialize(config);
        if (recognizer) {
          results = this.gestureService.recognizeImage(canvas);
        }
      }

      const inferenceTime = Math.round(performance.now() - startTime);

      if (results) {
        this.drawLandmarks(ctx, results, canvas.width, canvas.height);
        this.drawCategoryLabels(ctx, results, canvas.width, canvas.height);

        let label = 'N/A';
        let gesture = 'N/A';
        let gestureScore = 0;
        const detectedHandsList: any[] = [];
        if (results.handedness) {
          for (let i = 0; i < results.handedness.length; i++) {
            const handData = results.handedness[i][0];
            const handLabel = handData.categoryName === 'Left' ? 'LEFT' : 'RIGHT';
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

        if (detectedHandsList.length > 0) {
          label = detectedHandsList[0].handedness;
          gesture = detectedHandsList[0].gesture;
          gestureScore = detectedHandsList[0].gestureScore;
        }

        this.imageProcessed.emit({
          inferenceTime,
          handsDetected: results.landmarks ? results.landmarks.length : 0,
          handedness: label,
          gesture,
          gestureScore,
          detectedHandsList
        });
      }
    } catch (err) {
      console.error('Static canvas image inference failure:', err);
    } finally {
      this.isLoading = false;
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

  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  clearImage() {
    this.imageSrc = null;
    this.metadata = null;
    this.loadedImage = null;
    this.metadataExtracted.emit(null as any);
    this.imageProcessed.emit(null);
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

      const handLabel = handedness[0].categoryName === 'Left' ? 'LEFT' : 'RIGHT';
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
