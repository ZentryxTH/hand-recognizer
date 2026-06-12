import { Component, ElementRef, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonItem, IonLabel, IonIcon, IonButton, IonSelect, IonSelectOption, IonSegment, IonSegmentButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { videocamOutline, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-camera-setting',
  templateUrl: './cameraSetting.component.html',
  styleUrls: ['./cameraSetting.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonItem, IonLabel, IonIcon, IonButton,
    IonSelect, IonSelectOption, IonSegment, IonSegmentButton
  ]
})
export class CameraSettingComponent implements OnDestroy {
  @Input() cameras: MediaDeviceInfo[] = [];
  @Input() selectedCameraId: string | null = null;
  @Input() isFrontCamera = true;
  private _isOpen = false;
  private clickListener: ((event: MouseEvent) => void) | null = null;

  @Input()
  set isOpen(value: boolean) {
    if (this._isOpen === value) return;
    this._isOpen = value;
    if (value) {
      this.addClickListener();
    } else {
      this.removeClickListener();
    }
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  @Output() cameraChange = new EventEmitter<string | null>();
  @Output() isFrontCameraChange = new EventEmitter<boolean>();
  @Output() isOpenChange = new EventEmitter<boolean>();

  constructor(private elementRef: ElementRef) {
    addIcons({ videocamOutline, closeOutline });
  }

  togglePanel(event?: MouseEvent) {
    event?.stopPropagation();
    const nextState = !this.isOpen;
    this.isOpen = nextState;
    this.isOpenChange.emit(nextState);
  }

  ngOnDestroy() {
    this.removeClickListener();
  }

  private addClickListener() {
    this.removeClickListener();
    this.clickListener = (e) => this.onDocumentClick(e);
    setTimeout(() => {
      if (this.isOpen && this.clickListener) {
        document.addEventListener('click', this.clickListener);
      }
    }, 0);
  }

  private removeClickListener() {
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
      this.clickListener = null;
    }
  }

  private onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target) return;

    const isIonicOverlay = target.closest('ion-popover') ||
                           target.closest('.select-interface-option') ||
                           target.closest('ion-alert') ||
                           target.closest('ion-action-sheet');

    if (this.isOpen && !this.elementRef.nativeElement.contains(target) && !isIonicOverlay) {
      this.isOpen = false;
      this.isOpenChange.emit(false);
      this.removeClickListener();
    }
  }

  onCameraSelect(event: Event) {
    const customEvent = event as CustomEvent;
    const val = customEvent.detail.value;
    this.cameraChange.emit(val === 'default' ? null : val);
  }

  onCameraDirectionToggle(event: Event) {
    const customEvent = event as CustomEvent;
    const val = customEvent.detail.value === 'front';
    this.isFrontCameraChange.emit(val);
  }

  trackByCameraId(index: number, camera: MediaDeviceInfo): string {
    return camera.deviceId;
  }
}
