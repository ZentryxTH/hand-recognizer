import { Component } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { scan } from 'ionicons/icons';

@Component({
  selector: 'app-tab-bar',
  templateUrl: './tabBar.component.html',
  styleUrls: ['./tabBar.component.scss'],
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabBarComponent {
  constructor() {
    addIcons({ scan });
  }
}