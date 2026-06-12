import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetectedHand } from '../../../models/telemetry.interface';

@Component({
  selector: 'app-video-status',
  templateUrl: './videoStatus.component.html',
  styleUrls: ['./videoStatus.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class VideoStatusComponent {

  @Input() fps = 0;
  @Input() inferenceTime = 0;
  @Input() doneTime = 0;
  @Input() handsDetected = 0;
  @Input() handedness = 'N/A';
  @Input() gesture = 'N/A';
  @Input() gestureScore = 0;
  @Input() detectedHandsList: DetectedHand[] = [];
  @Input() streamWidth = 0;
  @Input() streamHeight = 0;

  trackByIndex(index: number): number {
    return index;
  }
}
