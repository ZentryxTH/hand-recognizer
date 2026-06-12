import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon, IonSpinner, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudUploadOutline, imageOutline, cropOutline, resizeOutline, arrowRedoOutline, arrowUndoOutline } from 'ionicons/icons';
import { HandLandmarkerService } from '../../models/handLandmarkers/handLandmarker.service';
import { GestureRecognizerService } from '../../models/gestureRecognizer/gestureRecognizer.service';
import { ImageMetadata } from '../../models/image-metadata.interface';
import { ImageProcessedData } from '../../models/telemetry.interface';
import { parseAspectRatio } from '../../utils/aspect-ratio.utils';
import { drawLandmarks, drawCategoryLabels } from '../../utils/drawing.utils';
import { extractHandTelemetry } from '../../utils/telemetry.utils';

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

  @Output() imageProcessed = new EventEmitter<ImageProcessedData | null>();
  @Output() metadataExtracted = new EventEmitter<ImageMetadata | null>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasOverlay') canvasRef!: ElementRef<HTMLCanvasElement>;

  imageSrc: string | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  metadata: ImageMetadata | null = null;

  private loadedImage: HTMLImageElement | null = null;
  private currentFile: File | null = null;

  constructor(
    private handService: HandLandmarkerService,
    private gestureService: GestureRecognizerService
  ) {
    addIcons({ cloudUploadOutline, imageOutline, cropOutline, resizeOutline, arrowRedoOutline, arrowUndoOutline });
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (!this.loadedImage) return;

    const keys = [
      'selectedAspectRatio', 'targetResolution', 'rotationDegrees',
      'activeMode', 'maxHands', 'minDetectionConfidence',
      'minPresenceConfidence', 'minTrackingConfidence', 'delegate'
    ];
    const anyChanged = keys.some(key => changes[key] && !changes[key].firstChange);

    if (anyChanged) {
      const modelKeys = ['activeMode', 'maxHands', 'minDetectionConfidence', 'minPresenceConfidence', 'minTrackingConfidence', 'delegate'];
      const modelChanged = modelKeys.some(key => changes[key] && !changes[key].firstChange);
      
      await this.applyImageSettingsAndProcess(modelChanged);
    }
  }

  triggerSelect() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.currentFile = file;
    input.value = ''; // Reset input to allow re-selecting the same file
    this.isLoading = true;
    this.errorMessage = null;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (!e.target?.result) {
        this.isLoading = false;
        return;
      }
      this.imageSrc = e.target.result as string;

      const img = new Image();
      img.onload = () => {
        this.loadedImage = img;
        this.applyImageSettingsAndProcess(true);
      };
      img.onerror = () => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load the image. Please try another file.';
      };
      img.src = e.target.result as string;
    };
    reader.onerror = () => {
      this.isLoading = false;
      this.errorMessage = 'Failed to read the image file.';
    };
    reader.readAsDataURL(file);
  }

  private async applyImageSettingsAndProcess(forceModelInit = true) {
    if (!this.loadedImage || !this.imageSrc) return;

    this.isLoading = true;
    this.errorMessage = null;
    const img = this.loadedImage;
    const file = this.currentFile;
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
      const targetRatio = parseAspectRatio(this.selectedAspectRatio);

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

    // Clean up temp canvas backing store to prevent memory leaks
    tempCanvas.width = 0;
    tempCanvas.height = 0;

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
        if (forceModelInit) {
          await this.handService.initialize(config);
        }
        results = this.handService.detectImage(canvas);
      } else {
        if (forceModelInit) {
          await this.gestureService.initialize(config);
        }
        results = this.gestureService.recognizeImage(canvas);
      }

      const inferenceTime = Math.round(performance.now() - startTime);

      if (results) {
        drawLandmarks(ctx, results, canvas.width, canvas.height);
        drawCategoryLabels(ctx, results, canvas.width, canvas.height, this.activeMode, false);

        const detectedHandsList = extractHandTelemetry(results, false);
        const handsDetected = detectedHandsList.length;
        let label = 'N/A';
        let gesture = 'N/A';
        let gestureScore = 0;

        if (detectedHandsList.length > 0) {
          label = detectedHandsList[0].handedness;
          gesture = detectedHandsList[0].gesture;
          gestureScore = detectedHandsList[0].gestureScore;
        }

        this.imageProcessed.emit({
          inferenceTime,
          handsDetected,
          handedness: label,
          gesture,
          gestureScore,
          detectedHandsList
        });
      } else {
        this.errorMessage = 'Failed to analyze the image using MediaPipe.';
      }
    } catch (err) {
      console.error('Static canvas image inference failure:', err);
      this.errorMessage = 'Static canvas image inference failure. Please check the model files or browser capabilities.';
    } finally {
      this.isLoading = false;
    }
  }

  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  clearImage() {
    this.imageSrc = null;
    this.metadata = null;
    this.loadedImage = null;
    this.currentFile = null;
    this.errorMessage = null;
    this.metadataExtracted.emit(null);
    this.imageProcessed.emit(null);
  }
}
