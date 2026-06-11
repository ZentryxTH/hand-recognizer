import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { imageOutline } from 'ionicons/icons';

export interface ImageMeta {
  name: string;
  size: string;
  type: string;
  originalResolution: string;
  processedResolution: string;
  rotation: number;
}

@Component({
  selector: 'app-image-metadata',
  templateUrl: './imageMetadata.component.html',
  styleUrls: ['./imageMetadata.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon]
})
export class ImageMetadataComponent {
  @Input() metadata: ImageMeta | null = null;
  @Input() delegate: 'GPU' | 'CPU' = 'GPU';
  @Input() activeMode: 'hand-landmarker' | 'gesture-recognizer' = 'hand-landmarker';
  @Input() detectedHandsList: Array<{ handedness: string, score: number, gesture: string, gestureScore: number }> = [];

  constructor() {
    addIcons({ imageOutline });
  }
}
