import { Component, ElementRef, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonItem, IonLabel, IonIcon, IonButton, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { resizeOutline, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-video-setting',
  templateUrl: './videoSetting.component.html',
  styleUrls: ['./videoSetting.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonItem, IonLabel, IonIcon, IonButton,
    IonSelect, IonSelectOption
  ]
})
export class VideoSettingComponent {
  @Input() targetResolution: '4k' | '2k' | '1080p' | '720p' | '480p' | 'device' = '1080p';
  @Input() selectedAspectRatio: '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1' = '16:9';
  @Input() availableResolutions: any[] = [];


  @Output() resolutionChange = new EventEmitter<'4k' | '2k' | '1080p' | '720p' | '480p' | 'device'>();
  @Output() aspectRatioChange = new EventEmitter<'16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1'>();

  isOpen = false;

  constructor(private elementRef: ElementRef) {
    addIcons({ resizeOutline, closeOutline });
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
}
