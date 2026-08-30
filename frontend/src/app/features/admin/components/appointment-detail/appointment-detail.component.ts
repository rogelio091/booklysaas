import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { AppointmentAdminDto } from '@bookly/contracts';
import { ApiService } from '../../../../core/services/api.service';

type AppointmentStatus = AppointmentAdminDto['status'];

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  canceled: 'Cancelada',
  no_show: 'No show',
};

// Estados a los que se puede transicionar desde el detalle de la cita.
const ACTIONABLE_STATUSES: AppointmentStatus[] = ['confirmed', 'completed', 'canceled', 'no_show'];

@Component({
  selector: 'app-appointment-detail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (appointment) {
      <div class="dark-modal-backdrop" (click)="onBackdropClick($event)">
        <div class="dark-modal-card" role="dialog" aria-modal="true" aria-label="Detalle de cita">
          <div class="modal-head">
            <h2>{{ appointment.serviceName || 'Cita' }}</h2>
            <button type="button" class="btn-close" (click)="close()" aria-label="Cerrar">✕</button>
          </div>

          <div class="detail-body">
            <div class="badge-row">
              <span class="status-pill" [attr.data-status]="appointment.status">
                {{ statusLabel(appointment.status) }}
              </span>
              <span class="source-badge">{{ sourceLabel(appointment.source) }}</span>
            </div>

            <div class="detail-grid">
              <div class="detail-field">
                <label>Cliente</label>
                <span class="value">{{ appointment.customerName }}</span>
                <span class="value-sub">{{ appointment.customerPhone }}</span>
              </div>
              <div class="detail-field">
                <label>Especialista</label>
                <span class="value">{{ appointment.staffName || 'Cualquiera disponible' }}</span>
              </div>
              <div class="detail-field">
                <label>Fecha</label>
                <span class="value">{{ appointment.startAt | date: 'dd/MM/yyyy' }}</span>
              </div>
              <div class="detail-field">
                <label>Hora</label>
                <span class="value">
                  {{ appointment.startAt | date: 'shortTime' }} –
                  {{ appointment.endAt | date: 'shortTime' }}
                </span>
              </div>
              <div class="detail-field">
                <label>Precio</label>
                <span class="value">{{ formatPrice(appointment.priceQtz) }}</span>
              </div>
            </div>

            @if (appointment.notes) {
              <div class="detail-field">
                <label>Notas</label>
                <p class="notes">{{ appointment.notes }}</p>
              </div>
            }

            @if (appointment.cancellationReason && appointment.status === 'canceled') {
              <div class="detail-field">
                <label>Motivo de cancelación</label>
                <p class="notes">{{ appointment.cancellationReason }}</p>
              </div>
            }

            <div class="divider"></div>

            <div class="section-title">Cambiar estado</div>
            <div class="status-actions">
              @for (s of actionableStatuses; track s) {
                <button
                  type="button"
                  class="status-btn"
                  [class.active]="s === appointment.status"
                  [attr.data-status]="s"
                  [disabled]="saving() || s === appointment.status"
                  (click)="selectStatus(s)"
                >
                  {{ statusLabel(s) }}
                </button>
              }
            </div>

            @if (pendingStatus() === 'canceled') {
              <div class="cancel-reason">
                <label for="cancellationReason">Motivo de cancelación</label>
                <textarea
                  id="cancellationReason"
                  rows="2"
                  [value]="cancellationReason()"
                  (input)="onReasonInput($event)"
                  placeholder="¿Por qué se cancela la cita?"
                ></textarea>
                <div class="cancel-actions">
                  <button type="button" class="btn-cancel" (click)="pendingStatus.set(null)">
                    Volver
                  </button>
                  <button
                    type="button"
                    class="btn-danger"
                    [disabled]="saving()"
                    (click)="applyStatus('canceled')"
                  >
                    {{ saving() ? 'Guardando...' : 'Confirmar cancelación' }}
                  </button>
                </div>
              </div>
            }

            @if (error()) {
              <div class="submit-error">{{ error() }}</div>
            }

            <div class="divider"></div>

            <div class="modal-actions">
              <button type="button" class="btn-delete" [disabled]="saving()" (click)="onDelete()">
                Eliminar
              </button>
              <button type="button" class="btn-cancel" (click)="close()">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .dark-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 200;
        padding: 1rem;
      }
      .dark-modal-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border-highlight);
        padding: 1.75rem;
        border-radius: var(--radius-lg);
        width: 100%;
        max-width: 560px;
        max-height: 92vh;
        overflow-y: auto;
        box-shadow: var(--shadow-card);
      }
      .modal-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
        h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #fff;
        }
      }
      .btn-close {
        background: transparent;
        border: none;
        color: var(--color-text-muted);
        font-size: 1.1rem;
        cursor: pointer;
        padding: 0.25rem;
        &:hover {
          color: #fff;
        }
      }
      .detail-body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .badge-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.7rem;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: 700;
        border: 1px solid var(--color-border);
        &[data-status='confirmed'] {
          color: var(--color-primary);
          background: var(--color-primary-light);
          border-color: var(--color-primary);
        }
        &[data-status='completed'] {
          color: var(--color-success);
          background: var(--color-success-bg);
          border-color: var(--color-success);
        }
        &[data-status='pending'] {
          color: var(--color-warning);
          background: var(--color-warning-bg);
          border-color: var(--color-warning);
        }
        &[data-status='canceled'],
        &[data-status='no_show'] {
          color: var(--color-danger);
          background: var(--color-danger-bg);
          border-color: var(--color-danger);
        }
      }
      .source-badge {
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--color-text-muted);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        padding: 0.2rem 0.6rem;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .detail-field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--color-text-muted);
        }
        .value {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-text);
        }
        .value-sub {
          font-size: 0.8rem;
          color: var(--color-text-muted);
        }
      }
      .notes {
        margin: 0;
        font-size: 0.85rem;
        color: var(--color-text);
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 0.6rem 0.75rem;
        white-space: pre-wrap;
      }
      .divider {
        height: 1px;
        background: var(--color-border);
      }
      .section-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--color-text-muted);
      }
      .status-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .status-btn {
        padding: 0.5rem 0.9rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
        background: rgba(255, 255, 255, 0.05);
        color: var(--color-text);
        font-weight: 600;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.15s;
        &:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--color-border-highlight);
        }
        &:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        &[data-status='confirmed'] {
          color: var(--color-primary);
        }
        &[data-status='completed'] {
          color: var(--color-success);
        }
        &[data-status='canceled'],
        &[data-status='no_show'] {
          color: var(--color-danger);
        }
        &.active {
          border-color: var(--color-primary);
          background: var(--color-primary-light);
        }
      }
      .cancel-reason {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        background: var(--color-danger-bg);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: var(--radius-md);
        label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-danger);
        }
        textarea {
          padding: 0.65rem 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: white;
          font-family: inherit;
          font-size: 0.875rem;
          outline: none;
          resize: vertical;
          &:focus {
            border-color: var(--color-danger);
          }
        }
      }
      .cancel-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .submit-error {
        background: var(--color-danger-bg);
        color: var(--color-danger);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: var(--radius-sm);
        padding: 0.6rem 0.8rem;
        font-size: 0.8rem;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      .btn-cancel {
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text);
        padding: 0.65rem 1.25rem;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-weight: 600;
        &:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      }
      .btn-danger {
        background: var(--color-danger);
        color: white;
        border: none;
        padding: 0.65rem 1.35rem;
        border-radius: var(--radius-md);
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        &:hover:not(:disabled) {
          opacity: 0.9;
        }
        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
      .btn-delete {
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: var(--color-danger);
        padding: 0.65rem 1.25rem;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-weight: 600;
        &:hover:not(:disabled) {
          background: var(--color-danger-bg);
        }
        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }

      /* ===== RESPONSIVE ===== */
      @media (max-width: 767px) {
        .dark-modal-backdrop {
          padding: 0;
          align-items: flex-end;
        }
        .dark-modal-card {
          max-width: 100%;
          max-height: 92vh;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          border-bottom: none;
        }
        .detail-grid {
          grid-template-columns: 1fr;
        }
        .modal-actions {
          flex-direction: column-reverse;
        }
        .modal-actions .btn-delete,
        .modal-actions .btn-cancel {
          width: 100%;
        }
        .cancel-actions {
          flex-direction: column;
        }
        .cancel-actions .btn-danger,
        .cancel-actions .btn-cancel {
          width: 100%;
        }
      }
    `,
  ],
})
export class AppointmentDetailComponent implements OnChanges {
  private readonly api = inject(ApiService);

  @Input() appointment: AppointmentAdminDto | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();

  protected readonly actionableStatuses: AppointmentStatus[] = ACTIONABLE_STATUSES;
  protected readonly saving = signal(false);
  protected readonly pendingStatus = signal<AppointmentStatus | null>(null);
  protected readonly cancellationReason = signal('');
  protected readonly error = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appointment'] && changes['appointment'].currentValue) {
      this.resetState();
    }
  }

  statusLabel(status: AppointmentStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  sourceLabel(source: AppointmentAdminDto['source']): string {
    switch (source) {
      case 'public_portal':
        return 'Portal web';
      case 'admin':
        return 'Panel admin';
      case 'staff':
        return 'Staff';
      default:
        return source;
    }
  }

  formatPrice(priceQtz: number | null): string {
    if (priceQtz == null) {
      return '—';
    }
    return `Q${(priceQtz / 100).toFixed(2)}`;
  }

  selectStatus(status: AppointmentStatus) {
    this.error.set(null);
    this.pendingStatus.set(null);

    if (status === 'canceled') {
      this.pendingStatus.set('canceled');
      this.cancellationReason.set(this.appointment?.cancellationReason ?? '');
      return;
    }

    this.applyStatus(status);
  }

  applyStatus(status: AppointmentStatus) {
    const apt = this.appointment;
    if (!apt) {
      return;
    }

    if (status === 'canceled' && !this.cancellationReason().trim()) {
      this.error.set('Indica el motivo de cancelación.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.api
      .updateAppointmentStatus(
        apt.id,
        status,
        status === 'canceled' ? this.cancellationReason().trim() : undefined,
      )
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.success) {
            this.changed.emit();
            this.close();
          } else {
            this.error.set(res.error?.message ?? 'No se pudo actualizar el estado.');
          }
        },
        error: () => {
          this.saving.set(false);
          this.error.set('No se pudo actualizar el estado. Inténtalo de nuevo.');
        },
      });
  }

  onDelete() {
    const apt = this.appointment;
    if (!apt) {
      return;
    }

    if (!confirm('¿Eliminar esta cita? Esta acción no se puede deshacer.')) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.api.deleteAppointment(apt.id).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.changed.emit();
          this.close();
        } else {
          this.error.set(res.error?.message ?? 'No se pudo eliminar la cita.');
        }
      },
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudo eliminar la cita. Inténtalo de nuevo.');
      },
    });
  }

  close() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onReasonInput(event: Event) {
    this.cancellationReason.set((event.target as HTMLTextAreaElement).value);
  }

  private resetState() {
    this.saving.set(false);
    this.pendingStatus.set(null);
    this.cancellationReason.set(this.appointment?.cancellationReason ?? '');
    this.error.set(null);
  }
}
