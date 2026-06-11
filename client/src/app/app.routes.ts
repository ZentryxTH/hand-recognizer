import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./scanner/scanner.page').then((m) => m.ScannerPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
