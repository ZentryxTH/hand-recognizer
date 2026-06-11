import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonSegment, IonSegmentButton, IonLabel } from '@ionic/angular/standalone';

@Component({
  selector: 'app-model-segments',
  templateUrl: './modelSegments.component.html',
  styleUrls: ['./modelSegments.component.scss'],
  standalone: true,
  imports: [IonSegment, IonSegmentButton, IonLabel]
})
export class ModelSegmentsComponent {
  @Input() activeMode: 'hand-landmarker' | 'gesture-recognizer' = 'hand-landmarker';
  @Output() modeChange = new EventEmitter<'hand-landmarker' | 'gesture-recognizer'>();

  onSegmentSelect(event: any) {
    this.modeChange.emit(event.detail.value);
  }
}