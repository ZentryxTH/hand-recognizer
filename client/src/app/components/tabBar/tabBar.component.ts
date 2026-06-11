import { Component } from '@angular/core';
import { IonTabBar, IonTabButton, IonIcon, IonLabel, IonTabs } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { scanOutline, settingsOutline, informationCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tab-bar',
  templateUrl: './tabBar.component.html',
  styleUrls: ['./tabBar.component.scss'],
  standalone: true,
  imports: [IonTabBar, IonTabButton, IonIcon, IonLabel, IonTabs]
})
export class TabBarComponent {
  constructor() {
    addIcons({ scanOutline, settingsOutline, informationCircleOutline });
  }
}