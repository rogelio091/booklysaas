import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import type {
  BlockedSlotResponseDto,
  CreateBlockedSlotDto,
  LocationResponseDto,
} from '@bookly/contracts';
import { ApiService, WorkingHourDto } from '../../../../core/services/api.service';

function toDateStrLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  imports: [CommonModule, ReactiveFormsModule],
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
      @if (affectedWarning()) {
        <div class="banner banner-warning">⚠ {{ affectedWarning() }}</div>
      }

      <!-- ===== Bloqueos de disponibilidad ===== -->
      <section class="blocks-section glass-card">
        <div class="section-head">
          <div>
            <h2>Bloqueos de disponibilidad</h2>
            <p class="section-subtitle">Deshabilita fechas u horarios específicos</p>
          </div>
          <button type="button" (click)="openBlockModal()" class="btn-primary-glow">
            + Bloquear
          </button>
        </div>

        @if (blockError()) {
          <div class="banner banner-error">{{ blockError() }}</div>
        }

        @if (blocksLoading()) {
          <div class="state-box">Cargando bloqueos...</div>
        } @else if (blocks().length === 0) {
          <div class="state-box">No hay bloqueos configurados.</div>
        } @else {
          <ul class="blocks-list">
            @for (block of blocks(); track block.id) {
              <li class="block-row">
                <div class="block-info">
                  <strong>{{ blockRange(block) }}</strong>
                  <span class="block-location">{{ locationLabel(block.locationId) }}</span>
                  @if (block.reason) {
                    <span class="block-reason">{{ block.reason }}</span>
                  }
                </div>
                <button type="button" (click)="deleteBlock(block)" class="btn-delete">
                  Eliminar
                </button>
              </li>
            }
          </ul>
        }
      </section>

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

      <!-- Modal crear bloqueo -->
      @if (showBlockModal()) {
        <div class="dark-modal-backdrop" (click)="onBlockBackdropClick($event)">
          <div class="dark-modal-card" role="dialog" aria-modal="true" aria-label="Bloquear disponibilidad">
            <div class="modal-head">
              <h2>Bloquear disponibilidad</h2>
              <button type="button" class="btn-close" (click)="closeBlockModal()" aria-label="Cerrar">✕</button>
            </div>

            <form [formGroup]="blockForm" (ngSubmit)="saveBlock()" class="block-form">
              <div class="form-group">
                <label for="blockDate">Fecha *</label>
                <input id="blockDate" type="date" formControlName="date" [min]="minBlockDate()" />
                @if (showBlockError('date')) {
                  <span class="field-error">La fecha es requerida</span>
                }
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="blockStart">Hora inicio *</label>
                  <input id="blockStart" type="time" formControlName="startTime" />
                  @if (showBlockError('startTime')) {
                    <span class="field-error">Requerida</span>
                  }
                </div>
                <div class="form-group">
                  <label for="blockEnd">Hora fin *</label>
                  <input id="blockEnd" type="time" formControlName="endTime" />
                  @if (showBlockError('endTime')) {
                    <span class="field-error">Requerida</span>
                  }
                </div>
              </div>

              @if (timeRangeInvalid()) {
                <div class="submit-error">La hora de fin debe ser posterior a la de inicio.</div>
              }

              <div class="form-group">
                <label for="blockLocation">Ubicación</label>
                <select id="blockLocation" formControlName="locationId">
                  <option [ngValue]="null">Toda la empresa</option>
                  @for (loc of selectableLocations(); track loc.id) {
                    <option [ngValue]="loc.id">{{ loc.name }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label for="blockReason">Motivo</label>
                <input
                  id="blockReason"
                  type="text"
                  formControlName="reason"
                  placeholder="Ej. Feriado, mantenimiento..."
                />
              </div>

              @if (submitBlockError()) {
                <div class="submit-error">{{ submitBlockError() }}</div>
              }

              <div class="modal-actions">
                <button type="button" (click)="closeBlockModal()" class="btn-cancel">Cancelar</button>
                <button
                  type="submit"
                  class="btn-primary-glow"
                  [disabled]="blockForm.invalid || savingBlock() || timeRangeInvalid()"
                >
                  {{ savingBlock() ? 'Guardando...' : 'Bloquear' }}
                </button>
              </div>
            </form>
          </div>
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
      .banner-warning {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .glass-card {
        background: var(--color-surface-glass);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        box-shadow: var(--shadow-card);
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      /* ===== BLOQUEOS ===== */
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        h2 {
          font-size: 1.1rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }
        .section-subtitle {
          color: var(--color-text-muted);
          font-size: 0.8rem;
          margin: 0.25rem 0 0;
        }
      }
      .blocks-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .block-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.8rem 0.9rem;
        background: rgba(0, 0, 0, 0.22);
        border: 1px solid var(--color-border);
        border-left: 3px solid var(--color-danger);
        border-radius: var(--radius-sm);
      }
      .block-info {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        strong {
          color: #ffffff;
          font-size: 0.875rem;
        }
        .block-location {
          color: var(--color-text-muted);
          font-size: 0.78rem;
        }
        .block-reason {
          color: var(--color-text-dim);
          font-size: 0.75rem;
          font-style: italic;
        }
      }
      .btn-delete {
        background: transparent;
        border: 1px solid var(--color-danger);
        color: var(--color-danger);
        padding: 0.45rem 0.9rem;
        border-radius: var(--radius-md);
        font-weight: 700;
        font-size: 0.78rem;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s;
        &:hover {
          background: rgba(239, 68, 68, 0.1);
        }
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

      /* ===== MODAL BLOQUEO ===== */
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
        max-width: 520px;
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
          margin: 0;
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
      .block-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-text-muted);
        }
        input,
        select {
          padding: 0.75rem 0.9rem;
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
          &.ng-invalid.ng-touched {
            border-color: var(--color-danger);
          }
        }
        select {
          appearance: none;
          option {
            color: #0f172a;
            background: #f8fafc;
          }
        }
      }
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .field-error {
        font-size: 0.72rem;
        color: var(--color-danger);
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
        margin-top: 0.5rem;
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

      /* ===== RESPONSIVE ===== */
      @media (max-width: 767px) {
        .header-flex {
          flex-direction: column;
          align-items: stretch;
        }
        .header-flex .btn-primary-glow {
          align-self: flex-start;
        }
        .section-head {
          flex-direction: column;
          align-items: stretch;
        }
        .section-head .btn-primary-glow {
          align-self: flex-start;
        }
        .schedule-grid {
          grid-template-columns: 1fr;
        }
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
        .form-row {
          grid-template-columns: 1fr;
        }
        .modal-actions {
          flex-direction: column-reverse;
        }
        .modal-actions .btn-primary-glow,
        .modal-actions .btn-cancel {
          width: 100%;
        }
      }
    `,
  ],
})
export class ScheduleComponent implements OnInit {
  private readonly api = inject(ApiService);

  // Estado de horarios laborales
  protected readonly schedule = signal<DaySchedule[]>(createEmptySchedule());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  // Estado de bloqueos
  protected readonly blocks = signal<BlockedSlotResponseDto[]>([]);
  protected readonly blocksLoading = signal(false);
  protected readonly blockError = signal<string | null>(null);
  protected readonly showBlockModal = signal(false);
  protected readonly savingBlock = signal(false);
  protected readonly submitBlockError = signal<string | null>(null);
  protected readonly affectedWarning = signal<string | null>(null);
  protected readonly locations = signal<LocationResponseDto[]>([]);
  protected readonly minBlockDate = signal(toDateStrLocal(new Date()));

  protected readonly selectableLocations = computed(() =>
    this.locations().filter((l) => l.isActive),
  );

  protected readonly blockForm = new FormGroup({
    date: new FormControl('', { nonNullable: true, validators: Validators.required }),
    startTime: new FormControl('', { nonNullable: true, validators: Validators.required }),
    endTime: new FormControl('', { nonNullable: true, validators: Validators.required }),
    locationId: new FormControl<number | null>(null),
    reason: new FormControl('', { nonNullable: true }),
  });

  // Señales reactivas derivadas del formulario para que el botón de bloqueo
  // reaccione en OnPush (FormControl.value no es una signal).
  protected readonly blockStart = signal('');
  protected readonly blockEnd = signal('');
  protected readonly timeRangeInvalid = computed(
    () => !!this.blockStart() && !!this.blockEnd() && this.blockEnd() <= this.blockStart(),
  );

  ngOnInit(): void {
    // Mantiene blockStart/blockEnd sincronizados con el formulario (reactividad OnPush).
    this.blockForm.controls.startTime.valueChanges.subscribe((v) => this.blockStart.set(v));
    this.blockForm.controls.endTime.valueChanges.subscribe((v) => this.blockEnd.set(v));
    this.loadSchedule();
    this.loadBlocks();
    this.loadLocations();
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

  // ===== Bloqueos =====
  private loadBlocks(): void {
    this.blocksLoading.set(true);
    this.blockError.set(null);
    this.api.getBlocks().subscribe({
      next: (res) => {
        if (res.success) {
          this.blocks.set([...(res.data ?? [])].sort((a, b) => a.startAt - b.startAt));
        } else {
          this.blockError.set(res.error?.message ?? 'No se pudieron cargar los bloqueos.');
        }
        this.blocksLoading.set(false);
      },
      error: () => {
        this.blockError.set('No se pudieron cargar los bloqueos.');
        this.blocksLoading.set(false);
      },
    });
  }

  private loadLocations(): void {
    this.api.getLocations().subscribe({
      next: (res) => {
        if (res.success) {
          this.locations.set(res.data);
        }
      },
      error: () => {
        // Las ubicaciones son opcionales: el select queda solo con "Toda la empresa".
      },
    });
  }

  protected openBlockModal(): void {
    this.submitBlockError.set(null);
    this.affectedWarning.set(null);
    this.minBlockDate.set(toDateStrLocal(new Date()));
    this.blockForm.reset({ date: '', startTime: '', endTime: '', locationId: null, reason: '' });
    this.showBlockModal.set(true);
  }

  protected closeBlockModal(): void {
    this.showBlockModal.set(false);
  }

  protected onBlockBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeBlockModal();
    }
  }

  protected saveBlock(): void {
    if (this.blockForm.invalid || this.timeRangeInvalid()) {
      this.blockForm.markAllAsTouched();
      return;
    }

    const payload = this.buildBlockPayload();
    if (!payload) {
      return;
    }

    this.savingBlock.set(true);
    this.submitBlockError.set(null);
    this.api.createBlock(payload).subscribe({
      next: (res) => {
        this.savingBlock.set(false);
        if (res.success) {
          const count = res.warnings?.affectedAppointments ?? 0;
          if (count > 0) {
            this.affectedWarning.set(
              `Hay ${count} cita${count === 1 ? '' : 's'} afectada${count === 1 ? '' : 's'} por este bloqueo.`,
            );
          }
          this.closeBlockModal();
          this.loadBlocks();
        } else {
          this.submitBlockError.set(res.error?.message ?? 'No se pudo crear el bloqueo.');
        }
      },
      error: (err) => {
        this.savingBlock.set(false);
        this.submitBlockError.set(this.backendErrorMessage(err));
      },
    });
  }

  protected deleteBlock(block: BlockedSlotResponseDto): void {
    if (!confirm('¿Eliminar este bloqueo?')) {
      return;
    }
    this.blockError.set(null);
    this.api.deleteBlock(block.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.loadBlocks();
        } else {
          this.blockError.set(res.error?.message ?? 'No se pudo eliminar el bloqueo.');
        }
      },
      error: (err) => {
        this.blockError.set(this.backendErrorMessage(err));
      },
    });
  }

  protected locationLabel(locationId: number | null): string {
    if (locationId === null || locationId === undefined) {
      return 'Toda la empresa';
    }
    return this.locations().find((l) => l.id === locationId)?.name ?? 'Toda la empresa';
  }

  protected blockRange(block: BlockedSlotResponseDto): string {
    return `${this.formatDateTime(block.startAt)} – ${this.formatDateTime(block.endAt)}`;
  }

  protected showBlockError(field: string): boolean {
    const control = this.blockForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  private buildBlockPayload(): CreateBlockedSlotDto | null {
    const raw = this.blockForm.getRawValue();
    if (!raw.date || !raw.startTime || !raw.endTime) {
      return null;
    }
    const startAt = new Date(`${raw.date}T${raw.startTime}`).getTime();
    const endAt = new Date(`${raw.date}T${raw.endTime}`).getTime();
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      return null;
    }
    return {
      locationId: raw.locationId,
      startAt,
      endAt,
      reason: raw.reason.trim() ? raw.reason.trim() : null,
    };
  }

  private formatDateTime(epoch: number): string {
    const d = new Date(epoch);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
  }

  private backendErrorMessage(err: unknown): string {
    const e = err as { error?: { error?: { message?: string } } };
    return e?.error?.error?.message ?? 'No se pudo completar la operación.';
  }
}
