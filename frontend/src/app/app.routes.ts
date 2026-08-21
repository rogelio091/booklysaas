import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'book/:slug',
    loadComponent: () =>
      import('./features/booking/booking.component').then((m) => m.BookingComponent),
  },
  {
    path: 'app',
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
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
