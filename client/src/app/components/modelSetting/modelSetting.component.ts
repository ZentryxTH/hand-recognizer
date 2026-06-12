import { Component, ElementRef, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
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
export class ModelSettingComponent implements OnDestroy {

  @Input() maxHands = 2;
  @Input() minDetectionConfidence = 0.5;
  @Input() minPresenceConfidence = 0.5;
  @Input() minTrackingConfidence = 0.5;
  @Input() delegate: 'GPU' | 'CPU' = 'GPU';
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

  @Output() maxHandsChange = new EventEmitter<number>();
  @Output() minDetectionConfidenceChange = new EventEmitter<number>();
  @Output() minPresenceConfidenceChange = new EventEmitter<number>();
  @Output() minTrackingConfidenceChange = new EventEmitter<number>();
  @Output() delegateChange = new EventEmitter<'GPU' | 'CPU'>();
  @Output() isOpenChange = new EventEmitter<boolean>();

  constructor(private elementRef: ElementRef) {
    addIcons({ sparklesOutline, closeOutline });
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

  onDelegateChange(event: Event) {
    const customEvent = event as CustomEvent;
    this.delegateChange.emit(customEvent.detail.value as 'GPU' | 'CPU');
  }

  onMaxHandsInput(event: Event) {
    const customEvent = event as CustomEvent;
    this.maxHandsChange.emit(Number(customEvent.detail.value));
  }

  onMinDetectionConfidenceInput(event: Event) {
    const customEvent = event as CustomEvent;
    this.minDetectionConfidenceChange.emit(Number(customEvent.detail.value));
  }

  onMinPresenceConfidenceInput(event: Event) {
    const customEvent = event as CustomEvent;
    this.minPresenceConfidenceChange.emit(Number(customEvent.detail.value));
  }

  onMinTrackingConfidenceInput(event: Event) {
    const customEvent = event as CustomEvent;
    this.minTrackingConfidenceChange.emit(Number(customEvent.detail.value));
  }
}
