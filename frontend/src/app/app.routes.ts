import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'book/:slug',
    loadComponent: () =>
      import('./features/booking/booking.component').then((m) => m.BookingComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'book/demo',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
