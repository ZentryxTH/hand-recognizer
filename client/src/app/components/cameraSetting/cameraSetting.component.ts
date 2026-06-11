import { Component, ElementRef, HostListener, Input, Output, EventEmitter } from '@angular/core';
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
export class CameraSettingComponent {
  @Input() cameras: MediaDeviceInfo[] = [];
  @Input() selectedCameraId: string | null = null;
  @Input() isFrontCamera = true;

  @Output() cameraChange = new EventEmitter<string | null>();
  @Output() isFrontCameraChange = new EventEmitter<boolean>();

  isOpen = false;

  constructor(private elementRef: ElementRef) {
    addIcons({ videocamOutline, closeOutline });
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target) return;

    const isIonicOverlay = target.closest('ion-popover') ||
                           target.closest('.select-interface-option') ||
                           target.closest('ion-alert') ||
                           target.closest('ion-action-sheet');

    if (this.isOpen && !this.elementRef.nativeElement.contains(target) && !isIonicOverlay) {
      this.isOpen = false;
    }
  }

  onCameraSelect(event: any) {
    const val = event.detail.value;
    this.cameraChange.emit(val === 'default' ? null : val);
  }

  onCameraDirectionToggle(event: any) {
    const val = event.detail.value === 'front';
    this.isFrontCameraChange.emit(val);
  }
}
