import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';
import { ModelSegmentsComponent } from '../components/modelSegments/modelSegments.component';

@Component({
  selector: 'app-scanner',
  standalone: true,
  templateUrl: 'scanner.page.html',
  styleUrls: ['scanner.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, ModelSegmentsComponent],
})
export class ScannerPage {
  constructor() {
    
  }
}
