import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'book/:slug',
    loadComponent: () =>
      import('./features/booking/booking.component').then((m) => m.BookingComponent),
  },
  {
    path: 'app/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'app',
    canActivate: [authGuard],
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
