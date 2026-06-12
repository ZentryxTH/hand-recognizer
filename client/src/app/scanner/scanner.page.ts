import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonContent, IonSegment, IonSegmentButton, IonLabel } from '@ionic/angular/standalone';
import { VideoPanelComponent } from '../components/videoPanel/videoPanel.component';
import { ModelStatusComponent } from '../components/statusPanel/modelStatus/modelStatus.component';
import { VideoStatusComponent } from '../components/statusPanel/videoStatus/videoStatus.component';
import { ImageMetadataComponent } from '../components/statusPanel/imageMetadata/imageMetadata.component';
import { ModelSettingComponent } from '../components/modelSetting/modelSetting.component';
import { CameraSettingComponent } from '../components/cameraSetting/cameraSetting.component';
import { VideoSettingComponent } from '../components/videoSetting/videoSetting.component';
import { ImageUploaderComponent } from '../components/imageUploader/imageUploader.component';
import { ImageSettingComponent } from '../components/imageSetting/imageSetting.component';
import { ImageMetadata } from '../models/image-metadata.interface';
import { TelemetryData, ResolutionInfo, ImageProcessedData } from '../models/telemetry.interface';

@Component({
  selector: 'app-scanner',
  templateUrl: 'scanner.page.html',
  styleUrls: ['scanner.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    VideoPanelComponent,
    ModelStatusComponent,
    VideoStatusComponent,
    ImageMetadataComponent,
    ModelSettingComponent,
    CameraSettingComponent,
    VideoSettingComponent,
    ImageUploaderComponent,
    ImageSettingComponent
  ],
})
export class ScannerPage implements OnInit, OnDestroy {
  @ViewChild(VideoPanelComponent) videoPanel!: VideoPanelComponent;
  @ViewChild(ImageUploaderComponent) imageUploader!: ImageUploaderComponent;

  // Active configurations
  scanSource: 'webcam' | 'upload' = 'webcam';

  // Model parameters (expanded to support all confidence levels)
  maxHands = 2;
  minDetectionConfidence = 0.5;
  minPresenceConfidence = 0.5;
  minTrackingConfidence = 0.5;
  delegate: 'GPU' | 'CPU' = 'GPU';

  // Camera settings
  cameras: MediaDeviceInfo[] = [];
  selectedCameraId: string | null = null;
  isFrontCamera = true;
  targetResolution: '4k' | '2k' | '1080p' | '720p' | '480p' | 'device' = '1080p';
  selectedAspectRatio: '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1' = '16:9';

  // Upload image settings (decoupled from camera properties)
  imageAspectRatio: 'original' | '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1' = 'original';
  imageResolution: 'original' | '4k' | '2k' | '1080p' | '720p' | '480p' = '720p';
  imageRotation = 0;

  // Centralized settings panel visibility state
  openMenu: 'model' | 'camera' | 'video' | 'image' | null = null;

  // Telemetry details
  modelLoadTime: number | null = null;
  showBadge = false;
  private badgeTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  // Parsed Upload Image Metadata
  uploadedMetadata: ImageMetadata | null = null;

  detectedResolutions: ResolutionInfo[] = [
    { label: 'Device Default', value: 'device' },
    { label: '1080p (Full HD)', value: '1080p' },
    { label: '720p (HD)', value: '720p' },
    { label: '480p (Standard)', value: '480p' }
  ];

  telemetry: TelemetryData = {
    fps: 0,
    inferenceTime: 0,
    doneTime: 0,
    handsDetected: 0,
    handedness: 'N/A',
    gesture: 'N/A',
    gestureScore: 0,
    detectedHandsList: [],
    streamWidth: 0,
    streamHeight: 0
  };

  ngOnInit() {
    this.loadPersistedSettings();
    if (window.innerWidth < 768 || window.matchMedia('(max-width: 767px)').matches) {
      this.selectedAspectRatio = '9:16';
      this.imageAspectRatio = '9:16';
    }
  }

  ngOnDestroy() {
    if (this.badgeTimer) {
      clearTimeout(this.badgeTimer);
      this.badgeTimer = null;
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  onMenuOpenChange(menu: 'model' | 'camera' | 'video' | 'image', isOpen: boolean) {
    if (isOpen) {
      this.openMenu = menu;
    } else if (this.openMenu === menu) {
      this.openMenu = null;
    }
  }

  loadPersistedSettings() {
    const savedDelegate = localStorage.getItem('cfg_delegate');
    if (savedDelegate) this.delegate = savedDelegate as 'GPU' | 'CPU';

    const savedMaxHands = localStorage.getItem('cfg_maxHands');
    if (savedMaxHands) this.maxHands = parseInt(savedMaxHands, 10);

    const savedMinDet = localStorage.getItem('cfg_minDetectionConfidence');
    if (savedMinDet) this.minDetectionConfidence = parseFloat(savedMinDet);

    const savedMinPres = localStorage.getItem('cfg_minPresenceConfidence');
    if (savedMinPres) this.minPresenceConfidence = parseFloat(savedMinPres);

    const savedMinTrack = localStorage.getItem('cfg_minTrackingConfidence');
    if (savedMinTrack) this.minTrackingConfidence = parseFloat(savedMinTrack);
  }


  onSourceChange(event: any) {
    this.scanSource = event.detail.value;
    this.uploadedMetadata = null;
    this.onTelemetryUpdate(null);
  }

  onTelemetryUpdate(data: TelemetryData | ImageProcessedData | null) {
    if (!data) {
      this.telemetry = {
        fps: 0,
        inferenceTime: 0,
        doneTime: 0,
        handsDetected: 0,
        handedness: 'N/A',
        gesture: 'N/A',
        gestureScore: 0,
        detectedHandsList: [],
        streamWidth: 0,
        streamHeight: 0
      };
      return;
    }
    this.telemetry = {
      fps: ('fps' in data ? data.fps : 0) || 0,
      inferenceTime: data.inferenceTime || 0,
      doneTime: ('doneTime' in data ? data.doneTime : data.inferenceTime) || 0,
      handsDetected: data.handsDetected || 0,
      handedness: data.handedness || 'N/A',
      gesture: data.gesture || 'N/A',
      gestureScore: data.gestureScore || 0,
      detectedHandsList: data.detectedHandsList || [],
      streamWidth: ('streamWidth' in data ? data.streamWidth : 0) || 0,
      streamHeight: ('streamHeight' in data ? data.streamHeight : 0) || 0
    };
  }

  onResolutionsDetected(list: ResolutionInfo[]) {
    this.detectedResolutions = list;
  }

  onMetadataExtracted(meta: ImageMetadata | null) {
    this.uploadedMetadata = meta;
  }

  onCamerasEnumerated(list: MediaDeviceInfo[]) {
    this.cameras = list;
  }

  onModelLoaded(loadTimeMs: number) {
    this.modelLoadTime = loadTimeMs;
    this.showBadge = true;

    if (this.badgeTimer) {
      clearTimeout(this.badgeTimer);
      this.badgeTimer = null;
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }

    this.badgeTimer = setTimeout(() => {
      this.showBadge = false;
      this.fadeTimer = setTimeout(() => {
        this.modelLoadTime = null;
        this.fadeTimer = null;
      }, 500);
      this.badgeTimer = null;
    }, 4000);
  }

  // Configuration persistence changes
  onMaxHandsChange(val: number) { 
    this.maxHands = val; 
    localStorage.setItem('cfg_maxHands', val.toString());
  }

  onMinDetectionConfidenceChange(val: number) {
    this.minDetectionConfidence = val;
    localStorage.setItem('cfg_minDetectionConfidence', val.toString());
  }

  onMinPresenceConfidenceChange(val: number) {
    this.minPresenceConfidence = val;
    localStorage.setItem('cfg_minPresenceConfidence', val.toString());
  }

  onMinTrackingConfidenceChange(val: number) {
    this.minTrackingConfidence = val;
    localStorage.setItem('cfg_minTrackingConfidence', val.toString());
  }

  onDelegateChange(val: 'GPU' | 'CPU') { 
    this.delegate = val; 
    localStorage.setItem('cfg_delegate', val);
  }

  onCameraChange(id: string | null) { this.selectedCameraId = id; }
  onFrontCameraChange(flag: boolean) { this.isFrontCamera = flag; }
  onResolutionChange(res: '4k' | '2k' | '1080p' | '720p' | '480p' | 'device') { this.targetResolution = res; }
  onAspectRatioChange(ratio: '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1') { this.selectedAspectRatio = ratio; }

  // Decoupled Image adjustment settings
  onImageAspectRatioChange(val: any) { this.imageAspectRatio = val; }
  onImageResolutionChange(val: any) { this.imageResolution = val; }
  onImageRotateClockwise() { this.imageRotation = (this.imageRotation + 90) % 360; }
  onImageRotateCounterClockwise() { this.imageRotation = (this.imageRotation - 90 + 360) % 360; }

  isMenuOpen(): boolean {
    return this.openMenu !== null;
  }
}
