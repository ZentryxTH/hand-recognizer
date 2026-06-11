import { Routes } from '@angular/router';
import { TabBarComponent } from './components/tabBar/tabBar.component';

export const routes: Routes = [
  {
    path: '',
    component: TabBarComponent,
    children: [
      {
        path: 'scanner',
        loadComponent: () => import('./scanner/scanner.page').then((m) => m.ScannerPage),
      },
    ],
  },
  {
    path: '',
    redirectTo: 'scanner',
    pathMatch: 'full',
  },
];
