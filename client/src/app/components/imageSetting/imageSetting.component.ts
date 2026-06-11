import { Component, ElementRef, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonItem, IonLabel, IonIcon, IonButton, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cropOutline, closeOutline, arrowRedoOutline, arrowUndoOutline } from 'ionicons/icons';

@Component({
  selector: 'app-image-setting',
  templateUrl: './imageSetting.component.html',
  styleUrls: ['./imageSetting.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonItem, IonLabel, IonIcon, IonButton,
    IonSelect, IonSelectOption
  ]
})
export class ImageSettingComponent {
  @Input() selectedAspectRatio: 'original' | '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1' = 'original';
  @Input() targetResolution: 'original' | '4k' | '2k' | '1080p' | '720p' | '480p' = '720p';
  @Input() rotationDegrees = 0;

  @Output() aspectRatioChange = new EventEmitter<'original' | '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1'>();
  @Output() resolutionChange = new EventEmitter<'original' | '4k' | '2k' | '1080p' | '720p' | '480p'>();
  @Output() rotateClockwise = new EventEmitter<void>();
  @Output() rotateCounterClockwise = new EventEmitter<void>();

  isOpen = false;

  constructor(private elementRef: ElementRef) {
    addIcons({ cropOutline, closeOutline, arrowRedoOutline, arrowUndoOutline });
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
