import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-model-status',
  templateUrl: './modelStatus.component.html',
  styleUrls: ['./modelStatus.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class ModelStatusComponent {

  @Input() delegate: 'GPU' | 'CPU' = 'GPU';
  @Input() modelLoadTime: number | null = null;
}
