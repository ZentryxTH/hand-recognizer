import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { imageOutline } from 'ionicons/icons';
import { ImageMetadata } from '../../../models/image-metadata.interface';
import { DetectedHand } from '../../../models/telemetry.interface';

@Component({
  selector: 'app-image-metadata',
  templateUrl: './imageMetadata.component.html',
  styleUrls: ['./imageMetadata.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon]
})
export class ImageMetadataComponent {
  @Input() metadata: ImageMetadata | null = null;
  @Input() delegate: 'GPU' | 'CPU' = 'GPU';

  @Input() detectedHandsList: DetectedHand[] = [];

  constructor() {
    addIcons({ imageOutline });
  }

  get fileFormat(): string {
    return this.metadata?.type?.split('/')[1]?.toUpperCase() ?? 'UNKNOWN';
  }

  trackByIndex(index: number): number {
    return index;
  }
}
