import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import type { AppointmentAdminDto } from '@bookly/contracts';
import { AppointmentCreateComponent } from '../../components/appointment-create/appointment-create.component';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-appointments-page',
  standalone: true,
  imports: [CommonModule, AppointmentCreateComponent],
  template: `
    <div class="page-shell">
      <header class="header-flex">
        <div class="header-title">
          <h1>Agenda de Citas</h1>
          <p class="subtitle">Gestiona y consulta las reservas en tiempo real</p>
        </div>
        <div class="header-actions">
          <button (click)="showCreateModal.set(true)" class="btn-primary-glow">+ Nueva Cita</button>
          <button (click)="loadAppointments()" class="btn-glass">🔄 Actualizar</button>
        </div>
      </header>

      <!-- KPI Cards Row -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Citas Registradas</div>
          <div class="kpi-value">{{ appointments().length }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Citas Confirmadas</div>
          <div class="kpi-value text-success">{{ countConfirmed() }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Estado del Motor</div>
          <div class="kpi-value text-accent">En Línea</div>
        </div>
      </div>

      @if (loading()) {
        <div class="state-box">Cargando citas del tenant...</div>
      } @else {
        <div class="table-glass-card">
          <table class="dark-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Especialista</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (apt of appointments(); track apt.id) {
                <tr>
                  <td data-label="Fecha y Hora">
                    <strong>{{ apt.startAt | date:'mediumDate' }}</strong><br />
                    <small class="time-dim">{{ apt.startAt | date:'shortTime' }} - {{ apt.endAt | date:'shortTime' }}</small>
                  </td>
                  <td data-label="Cliente"><strong>{{ apt.customerName }}</strong></td>
                  <td data-label="Teléfono">{{ apt.customerPhone }}</td>
                  <td data-label="Especialista">{{ apt.staffName || 'Cualquiera disponible' }}</td>
                  <td data-label="Estado">
                    <span class="status-pill" [attr.data-status]="apt.status">
                      {{ apt.status }}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    @if (apt.status === 'confirmed') {
                      <button (click)="updateStatus(apt.id, 'completed')" class="btn-action complete">✓ Completar</button>
                      <button (click)="updateStatus(apt.id, 'canceled')" class="btn-action cancel">✕ Cancelar</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty-cell">No hay citas registradas en este momento.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <app-appointment-create
      [open]="showCreateModal()"
      (closed)="showCreateModal.set(false)"
      (created)="onAppointmentCreated()"
    />
  `,
  styles: [`
    .page-shell { display: flex; flex-direction: column; gap: 1.5rem; }
    .header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      h1 { font-size: 1.5rem; font-weight: 800; color: #ffffff; }
      .subtitle { color: var(--color-text-muted); font-size: 0.875rem; }
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .btn-primary-glow {
      background: var(--color-primary);
      color: white;
      border: none;
      padding: 0.55rem 1.25rem;
      border-radius: var(--radius-md);
      font-weight: 700;
      font-size: 0.825rem;
      cursor: pointer;
      box-shadow: var(--shadow-glow);
      transition: all 0.15s;
      white-space: nowrap;
      &:hover {
        background: var(--color-primary-hover);
        transform: translateY(-1px);
      }
    }
    .btn-glass {
      padding: 0.55rem 1rem;
      border: 1px solid var(--color-border);
      background: rgba(255, 255, 255, 0.05);
      color: var(--color-text);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 600;
      font-size: 0.825rem;
      transition: all 0.15s;
      white-space: nowrap;
      &:hover { background: rgba(255, 255, 255, 0.1); border-color: var(--color-border-highlight); }
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    .kpi-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.15rem 1.25rem;
    }
    .kpi-label { font-size: 0.75rem; font-weight: 700; color: var(--color-text-dim); text-transform: uppercase; margin-bottom: 0.35rem; }
    .kpi-value { font-size: 1.5rem; font-weight: 800; color: #ffffff; }
    .text-success { color: var(--color-success); }
    .text-accent { color: var(--color-accent); }
    .table-glass-card {
      background: var(--color-surface-glass);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
      overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    .dark-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td { padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-border); text-align: left; }
      th { background: rgba(0, 0, 0, 0.3); font-weight: 700; color: var(--color-text-muted); }
      td { color: var(--color-text); }
    }
    .time-dim { color: var(--color-text-muted); font-size: 0.75rem; }
    .status-pill {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: capitalize;
      &[data-status="confirmed"] { background: var(--color-success-bg); color: var(--color-success); border: 1px solid rgba(16, 185, 129, 0.3); }
      &[data-status="pending"] { background: var(--color-warning-bg); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.3); }
      &[data-status="completed"] { background: var(--color-primary-light); color: var(--color-primary); border: 1px solid var(--color-primary); }
      &[data-status="canceled"] { background: var(--color-danger-bg); color: var(--color-danger); border: 1px solid rgba(239, 68, 68, 0.3); }
    }
    .btn-action {
      padding: 0.3rem 0.6rem;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      margin-right: 0.35rem;
      &.complete { background: var(--color-success-bg); color: var(--color-success); }
      &.cancel { background: var(--color-danger-bg); color: var(--color-danger); }
    }
    .empty-cell { text-align: center; padding: 3rem !important; color: var(--color-text-muted); }
    .state-box { text-align: center; padding: 3rem; color: var(--color-text-muted); }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 767px) {
      .header-flex { flex-direction: column; align-items: stretch; }
      .header-actions { align-self: flex-start; }
      .header-flex .btn-glass { align-self: flex-start; }
      .kpi-grid { grid-template-columns: 1fr; gap: 0.75rem; }
      .kpi-card { padding: 0.9rem 1rem; }
      .kpi-value { font-size: 1.25rem; }

      /* Tabla → tarjetas */
      .dark-table thead { display: none; }
      .dark-table tbody, .dark-table tr, .dark-table td { display: block; width: 100%; }
      .dark-table tr {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        margin-bottom: 0.85rem;
        padding: 0.4rem 0.75rem;
        background: var(--color-surface-glass);
      }
      .dark-table td {
        border: none !important;
        padding: 0.45rem 0.4rem !important;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        text-align: right;
      }
      .dark-table td::before {
        content: attr(data-label);
        font-weight: 700;
        color: var(--color-text-muted);
        font-size: 0.7rem;
        text-transform: uppercase;
        flex-shrink: 0;
      }
      .dark-table td:last-child { justify-content: flex-start; }
      .dark-table td[data-label="Acciones"]::before { align-self: flex-start; margin-top: 0.35rem; }
    }
  `]
})
export class AppointmentsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly appointments = signal<AppointmentAdminDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly showCreateModal = signal(false);

  ngOnInit() {
    this.loadAppointments();
  }

  countConfirmed(): number {
    return this.appointments().filter((a) => a.status === 'confirmed').length;
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

  onAppointmentCreated() {
    this.showCreateModal.set(false);
    this.loadAppointments();
  }
}
