import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, WorkingHourDto } from '../../../../core/services/api.service';

interface DaySchedule {
  dayOfWeek: number;
  label: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
}

const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

// Orden de visualización: Lunes → Domingo (dayOfWeek 1..6, 0)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function createEmptySchedule(): DaySchedule[] {
  return DAY_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    label: DAY_LABELS[dayOfWeek],
    isActive: false,
    startTime: '',
    endTime: '',
    breakStartTime: '',
    breakEndTime: '',
  }));
}

@Component({
  selector: 'app-schedule-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <header class="header-flex">
        <div>
          <h1>Horarios de Disponibilidad</h1>
          <p class="subtitle">Define el horario semanal general de tu empresa</p>
        </div>
        <button
          type="button"
          (click)="saveSchedule()"
          class="btn-primary-glow"
          [disabled]="saving() || loading()"
        >
          {{ saving() ? 'Guardando…' : 'Guardar' }}
        </button>
      </header>

      @if (saved()) {
        <div class="banner banner-success">✓ Horarios guardados correctamente</div>
      }
      @if (error()) {
        <div class="banner banner-error">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="state-box">Cargando horarios...</div>
      } @else {
        <div class="schedule-grid">
          @for (day of schedule(); track day.dayOfWeek) {
            <div class="day-card" [class.is-inactive]="!day.isActive">
              <div class="day-head">
                <span class="day-name">{{ day.label }}</span>
                <label class="switch">
                  <input
                    type="checkbox"
                    [checked]="day.isActive"
                    (change)="toggleDay(day.dayOfWeek, $any($event.target).checked)"
                    [attr.aria-label]="'Activar ' + day.label"
                  />
                  <span class="slider"></span>
                </label>
              </div>

              @if (day.isActive) {
                <div class="time-grid">
                  <div class="field">
                    <label>Inicio</label>
                    <input
                      type="time"
                      [value]="day.startTime"
                      (change)="updateTime(day.dayOfWeek, 'startTime', $any($event.target).value)"
                    />
                  </div>
                  <div class="field">
                    <label>Fin</label>
                    <input
                      type="time"
                      [value]="day.endTime"
                      (change)="updateTime(day.dayOfWeek, 'endTime', $any($event.target).value)"
                    />
                  </div>
                  <div class="field">
                    <label>Break inicio</label>
                    <input
                      type="time"
                      [value]="day.breakStartTime"
                      (change)="updateTime(day.dayOfWeek, 'breakStartTime', $any($event.target).value)"
                    />
                  </div>
                  <div class="field">
                    <label>Break fin</label>
                    <input
                      type="time"
                      [value]="day.breakEndTime"
                      (change)="updateTime(day.dayOfWeek, 'breakEndTime', $any($event.target).value)"
                    />
                  </div>
                </div>
              } @else {
                <div class="unavailable">No disponible</div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page-shell {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .header-flex {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #ffffff;
        }
        .subtitle {
          color: var(--color-text-muted);
          font-size: 0.875rem;
        }
      }

      .btn-primary-glow {
        background: var(--color-primary);
        color: white;
        border: none;
        padding: 0.65rem 1.35rem;
        border-radius: var(--radius-md);
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        box-shadow: var(--shadow-glow);
        transition: all 0.15s;
        white-space: nowrap;
        &:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
        }
        &:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      }

      .banner {
        padding: 0.75rem 1rem;
        border-radius: var(--radius-md);
        font-size: 0.85rem;
        font-weight: 600;
      }
      .banner-success {
        background: var(--color-success-bg);
        color: var(--color-success);
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .banner-error {
        background: var(--color-danger-bg);
        color: var(--color-danger);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .schedule-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.25rem;
      }

      .day-card {
        background: var(--color-surface-glass);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        box-shadow: var(--shadow-card);
        transition: border-color 0.2s, opacity 0.2s;
        &.is-inactive {
          opacity: 0.7;
        }
      }

      .day-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
      }

      .day-name {
        font-size: 1.05rem;
        font-weight: 700;
        color: #ffffff;
      }

      /* Toggle switch */
      .switch {
        position: relative;
        display: inline-block;
        width: 46px;
        height: 24px;
        flex-shrink: 0;
        input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          transition: 0.2s;
          &::before {
            content: '';
            position: absolute;
            height: 18px;
            width: 18px;
            left: 3px;
            top: 2px;
            background: var(--color-text-muted);
            border-radius: 50%;
            transition: 0.2s;
          }
        }
        input:checked + .slider {
          background: var(--color-primary-light);
          border-color: var(--color-primary);
          &::before {
            transform: translateX(20px);
            background: var(--color-primary);
          }
        }
        input:focus-visible + .slider {
          box-shadow: 0 0 0 3px var(--color-primary-glow);
        }
      }

      .time-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        input {
          padding: 0.6rem 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: white;
          font-family: inherit;
          font-size: 0.875rem;
          outline: none;
          color-scheme: dark;
          &:focus {
            border-color: var(--color-primary);
            box-shadow: 0 0 0 3px var(--color-primary-glow);
          }
        }
      }

      .unavailable {
        color: var(--color-text-dim);
        font-size: 0.85rem;
        padding: 0.5rem 0;
      }

      .state-box {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-muted);
      }

      /* ===== RESPONSIVE ===== */
      @media (max-width: 767px) {
        .header-flex {
          flex-direction: column;
          align-items: stretch;
        }
        .header-flex .btn-primary-glow {
          align-self: flex-start;
        }
        .schedule-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ScheduleComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly schedule = signal<DaySchedule[]>(createEmptySchedule());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSchedule();
  }

  private loadSchedule(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getWorkingHours().subscribe({
      next: (res) => {
        if (res.success) {
          this.applyHours((res.data ?? []).filter((h) => h.userId === null));
        } else {
          this.error.set('No se pudieron cargar los horarios');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los horarios');
        this.loading.set(false);
      },
    });
  }

  private applyHours(hours: WorkingHourDto[]): void {
    const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
    this.schedule.set(
      DAY_ORDER.map((dayOfWeek) => {
        const h = byDay.get(dayOfWeek);
        return {
          dayOfWeek,
          label: DAY_LABELS[dayOfWeek],
          isActive: h?.isActive ?? false,
          startTime: h?.startTime ?? '',
          endTime: h?.endTime ?? '',
          breakStartTime: h?.breakStartTime ?? '',
          breakEndTime: h?.breakEndTime ?? '',
        };
      }),
    );
  }

  protected toggleDay(dayOfWeek: number, active: boolean): void {
    this.saved.set(false);
    this.schedule.update((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, isActive: active } : d)),
    );
  }

  protected updateTime(
    dayOfWeek: number,
    field: 'startTime' | 'endTime' | 'breakStartTime' | 'breakEndTime',
    value: string,
  ): void {
    this.saved.set(false);
    this.schedule.update((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d)),
    );
  }

  protected saveSchedule(): void {
    const hours = this.schedule()
      .filter((d) => d.isActive && d.startTime && d.endTime)
      .map((d) => ({
        userId: null,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        breakStartTime: d.breakStartTime || undefined,
        breakEndTime: d.breakEndTime || undefined,
        isActive: true,
      }));

    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);

    this.api.saveWorkingHours(hours).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudieron guardar los horarios');
      },
    });
  }
}
