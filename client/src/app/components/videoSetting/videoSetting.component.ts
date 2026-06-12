import { Component, ElementRef, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonItem, IonLabel, IonIcon, IonButton, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { resizeOutline, closeOutline } from 'ionicons/icons';
import { ResolutionInfo } from '../../models/telemetry.interface';

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
export class VideoSettingComponent implements OnDestroy {
  @Input() targetResolution: '4k' | '2k' | '1080p' | '720p' | '480p' | 'device' = '1080p';
  @Input() selectedAspectRatio: '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1' = '16:9';
  @Input() availableResolutions: ResolutionInfo[] = [];
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

  @Output() resolutionChange = new EventEmitter<'4k' | '2k' | '1080p' | '720p' | '480p' | 'device'>();
  @Output() aspectRatioChange = new EventEmitter<'16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1'>();
  @Output() isOpenChange = new EventEmitter<boolean>();

  constructor(private elementRef: ElementRef) {
    addIcons({ resizeOutline, closeOutline });
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

  onResolutionSelect(event: Event) {
    const customEvent = event as CustomEvent;
    this.resolutionChange.emit(customEvent.detail.value as '4k' | '2k' | '1080p' | '720p' | '480p' | 'device');
  }

  onAspectRatioSelect(event: Event) {
    const customEvent = event as CustomEvent;
    this.aspectRatioChange.emit(customEvent.detail.value as '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1');
  }

  trackByResolutionValue(index: number, res: ResolutionInfo): string {
    return res.value;
  }
}
