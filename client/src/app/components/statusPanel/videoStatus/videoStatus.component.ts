import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-status',
  templateUrl: './videoStatus.component.html',
  styleUrls: ['./videoStatus.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class VideoStatusComponent {
  @Input() activeMode: 'hand-landmarker' | 'gesture-recognizer' = 'hand-landmarker';
  @Input() fps = 0;
  @Input() inferenceTime = 0;
  @Input() doneTime = 0;
  @Input() handsDetected = 0;
  @Input() handedness = 'N/A';
  @Input() gesture = 'N/A';
  @Input() gestureScore = 0;
  @Input() detectedHandsList: Array<{ handedness: string, score: number, gesture: string, gestureScore: number }> = [];
  @Input() streamWidth = 0;
  @Input() streamHeight = 0;
}
