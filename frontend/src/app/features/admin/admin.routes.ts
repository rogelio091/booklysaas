import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'appointments',
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./pages/appointments/appointments.component').then(
            (m) => m.AppointmentsComponent,
          ),
      },
      {
        path: 'services',
        loadComponent: () =>
          import('./pages/services/services.component').then(
            (m) => m.ServicesComponent,
          ),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./pages/calendar/calendar.component').then(
            (m) => m.CalendarComponent,
          ),
      },
      {
        path: 'schedule',
        loadComponent: () =>
          import('./pages/schedule/schedule.component').then(
            (m) => m.ScheduleComponent,
          ),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./pages/customers/customers.component').then(
            (m) => m.CustomersComponent,
          ),
      },
    ],
  },
];
