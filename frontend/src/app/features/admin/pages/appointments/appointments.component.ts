import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import type { AppointmentAdminDto } from '@bookly/contracts';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-appointments-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1>Agenda de Citas</h1>
          <p class="subtitle">Gestiona y consulta las reservas en tiempo real</p>
        </div>
        <button (click)="loadAppointments()" class="btn-refresh">🔄 Actualizar</button>
      </header>

      @if (loading()) {
        <div class="state-msg">Cargando citas de la empresa...</div>
      } @else {
        <div class="table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Profesional</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (apt of appointments(); track apt.id) {
                <tr>
                  <td>
                    <strong>{{ apt.startAt | date:'mediumDate' }}</strong><br />
                    <small>{{ apt.startAt | date:'shortTime' }} - {{ apt.endAt | date:'shortTime' }}</small>
                  </td>
                  <td>{{ apt.customerName }}</td>
                  <td>{{ apt.customerPhone }}</td>
                  <td>{{ apt.staffName || 'Cualquiera disponible' }}</td>
                  <td>
                    <span class="status-pill" [attr.data-status]="apt.status">
                      {{ apt.status }}
                    </span>
                  </td>
                  <td>
                    @if (apt.status === 'confirmed') {
                      <button (click)="updateStatus(apt.id, 'completed')" class="btn-action complete">Completar</button>
                      <button (click)="updateStatus(apt.id, 'canceled')" class="btn-action cancel">Cancelar</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty-state">No hay citas registradas en este momento.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h1 { font-size: 1.5rem; }
      .subtitle { color: var(--color-text-muted); font-size: 0.875rem; }
    }
    .btn-refresh {
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 500;
    }
    .table-card {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
      overflow: hidden;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
      th, td {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border);
      }
      th {
        background: #f8fafc;
        font-weight: 600;
        color: var(--color-text-muted);
      }
    }
    .status-pill {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: capitalize;
      &[data-status="confirmed"] { background: #dcfce7; color: #166534; }
      &[data-status="pending"] { background: #fef9c3; color: #854d0e; }
      &[data-status="completed"] { background: #e0e7ff; color: #3730a3; }
      &[data-status="canceled"] { background: #fee2e2; color: #991b1b; }
    }
    .btn-action {
      padding: 0.25rem 0.5rem;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      cursor: pointer;
      margin-right: 0.25rem;
      &.complete { background: #dcfce7; color: #166534; }
      &.cancel { background: #fee2e2; color: #991b1b; }
    }
    .empty-state {
      text-align: center;
      padding: 3rem !important;
      color: var(--color-text-muted);
    }
    .state-msg {
      text-align: center;
      padding: 3rem;
      color: var(--color-text-muted);
    }
  `]
})
export class AppointmentsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly appointments = signal<AppointmentAdminDto[]>([]);
  protected readonly loading = signal(true);

  ngOnInit() {
    this.loadAppointments();
  }

  loadAppointments() {
    this.loading.set(true);
    this.http.get<ApiResponse<AppointmentAdminDto[]>>('/api/appointments').subscribe({
      next: (res) => {
        if (res.success) {
          this.appointments.set(res.data);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  updateStatus(id: number, status: 'completed' | 'canceled') {
    this.http.patch<ApiResponse<unknown>>(`/api/appointments/${id}/status`, { status }).subscribe({
      next: () => {
        this.loadAppointments();
      },
    });
  }
}
