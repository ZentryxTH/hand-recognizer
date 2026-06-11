import { Component, ElementRef, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { IonList, IonItem, IonLabel, IonRange, IonIcon, IonButton, IonSegment, IonSegmentButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sparklesOutline, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-model-setting',
  templateUrl: './modelSetting.component.html',
  styleUrls: ['./modelSetting.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonList, IonItem, IonLabel, IonRange, IonIcon, IonButton,
    IonSegment, IonSegmentButton, PercentPipe
  ]
})
export class ModelSettingComponent {
  @Input() activeMode: 'hand-landmarker' | 'gesture-recognizer' = 'hand-landmarker';
  @Input() maxHands = 2;
  @Input() minDetectionConfidence = 0.5;
  @Input() minPresenceConfidence = 0.5;
  @Input() minTrackingConfidence = 0.5;
  @Input() delegate: 'GPU' | 'CPU' = 'GPU';

  @Output() maxHandsChange = new EventEmitter<number>();
  @Output() minDetectionConfidenceChange = new EventEmitter<number>();
  @Output() minPresenceConfidenceChange = new EventEmitter<number>();
  @Output() minTrackingConfidenceChange = new EventEmitter<number>();
  @Output() delegateChange = new EventEmitter<'GPU' | 'CPU'>();

  isOpen = false;

  constructor(private elementRef: ElementRef) {
    addIcons({ sparklesOutline, closeOutline });
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
