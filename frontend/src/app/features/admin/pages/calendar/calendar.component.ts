import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import type { AppointmentAdminDto } from '@bookly/contracts';
import { AppointmentCreateComponent } from '../../components/appointment-create/appointment-create.component';
import { AppointmentDetailComponent } from '../../components/appointment-detail/appointment-detail.component';

type CalendarView = 'month' | 'week' | 'day';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface MonthDay {
  date: Date;
  dayKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  count: number;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function buildMonthGrid(anchor: Date, appointments: AppointmentAdminDto[]): MonthDay[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const todayKey = toDayKey(new Date());

  const counts = new Map<string, number>();
  for (const a of appointments) {
    const k = toDayKey(new Date(a.startAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const weeks: MonthDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: MonthDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d);
      const k = toDayKey(date);
      week.push({
        date,
        dayKey: k,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === anchor.getMonth(),
        isToday: k === todayKey,
        count: counts.get(k) ?? 0,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

function buildWeekDays(anchor: Date): Date[] {
  const start = addDays(anchor, -anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, AppointmentCreateComponent, AppointmentDetailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-shell">
      <header class="header-flex">
        <div class="header-title">
          <h1>Calendario</h1>
          <p class="subtitle">Vista de citas por mes, semana o día</p>
        </div>
        <div class="header-actions">
          <button (click)="showCreateModal.set(true)" class="btn-primary-glow">+ Nueva Cita</button>
          <button (click)="loadAppointments()" class="btn-glass">🔄 Actualizar</button>
        </div>
      </header>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="view-toggle">
          <button [class.active]="view() === 'month'" (click)="setView('month')">Mes</button>
          <button [class.active]="view() === 'week'" (click)="setView('week')">Semana</button>
          <button [class.active]="view() === 'day'" (click)="setView('day')">Día</button>
        </div>
        <div class="nav-group">
          <button class="nav-btn" (click)="prev()" aria-label="Anterior">‹</button>
          <span class="period-label">{{ periodLabel() }}</span>
          <button class="nav-btn" (click)="next()" aria-label="Siguiente">›</button>
          <button class="btn-today" (click)="goToday()">Hoy</button>
        </div>
      </div>

      @if (loading()) {
        <div class="state-box">Cargando citas del tenant...</div>
      } @else {
        @switch (view()) {
          @case ('month') {
            <div class="month-card glass-card">
              <div class="weekday-row">
                @for (w of weekdayNames; track w) {
                  <div class="weekday-cell">{{ w }}</div>
                }
              </div>
              @for (week of monthWeeks(); track $index) {
                <div class="week-row">
                  @for (day of week; track day.dayKey) {
                    <button
                      type="button"
                      class="month-day"
                      [class.outside]="!day.inCurrentMonth"
                      [class.today]="day.isToday"
                      [class.has-apt]="day.count > 0"
                      (click)="goDay(day.date)"
                    >
                      <span class="day-num">{{ day.dayNumber }}</span>
                      @if (day.count > 0) {
                        <span class="day-count">{{ day.count }}</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          }
          @case ('week') {
            <div class="week-scroll">
              <div class="week-grid">
                @for (day of weekDays(); track $index) {
                  <div class="week-col" [class.today]="isToday(day)">
                    <div class="week-col-header">
                      <span class="week-name">{{ weekdayShort(day) }}</span>
                      <span class="week-date">{{ day.getDate() }}</span>
                    </div>
                    <div class="week-col-body">
                      @for (a of appointmentsOn(dayKey(day)); track a.id) {
                        <div
                          class="apt-chip"
                          [attr.data-status]="a.status"
                          (click)="openAppointmentDetail(a)"
                        >
                          <strong>{{ a.startAt | date: 'shortTime' }}</strong>
                          <span>{{ a.customerName }}</span>
                        </div>
                      } @empty {
                        <div class="no-apt">Sin citas</div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
          @case ('day') {
            <div class="day-card glass-card">
              @if (dayAppointments().length === 0) {
                <div class="state-box">Sin citas para este día.</div>
              } @else {
                <div class="day-timeline">
                  @for (h of hours; track h) {
                    @if (appointmentsAtHour(h).length > 0) {
                      <div class="hour-row">
                        <div class="hour-label">{{ hourLabel(h) }}</div>
                        <div class="hour-body">
                          @for (a of appointmentsAtHour(h); track a.id) {
                            <div
                              class="apt-chip wide"
                              [attr.data-status]="a.status"
                              (click)="openAppointmentDetail(a)"
                            >
                              <strong
                                >{{ a.startAt | date: 'shortTime' }} –
                                {{ a.endAt | date: 'shortTime' }}</strong
                              >
                              <span>{{ a.customerName }}</span>
                              <small>{{ a.staffName || 'Cualquiera disponible' }}</small>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }
        }
      }
    </div>

    <app-appointment-create
      [open]="showCreateModal()"
      (closed)="showCreateModal.set(false)"
      (created)="onAppointmentCreated()"
    />

    <app-appointment-detail
      [appointment]="selectedAppointment()"
      (closed)="selectedAppointment.set(null)"
      (changed)="onAppointmentChanged()"
    />
  `,
  styles: `
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
      &:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: var(--color-border-highlight);
      }
    }

    /* ===== TOOLBAR ===== */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .view-toggle {
      display: inline-flex;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.25rem;
      gap: 0.25rem;
      button {
        background: transparent;
        border: none;
        color: var(--color-text-muted);
        font-size: 0.825rem;
        font-weight: 600;
        padding: 0.4rem 0.9rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.15s;
        &:hover {
          color: #ffffff;
        }
        &.active {
          background: var(--color-primary);
          color: #ffffff;
          box-shadow: var(--shadow-glow);
        }
      }
    }
    .nav-group {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .nav-btn,
    .btn-today {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--color-border);
      color: var(--color-text);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-weight: 700;
      padding: 0.4rem 0.7rem;
      transition: all 0.15s;
      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
    .period-label {
      min-width: 150px;
      text-align: center;
      font-weight: 700;
      color: #ffffff;
      font-size: 0.875rem;
    }

    .glass-card {
      background: var(--color-surface-glass);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
      overflow: hidden;
    }
    .state-box {
      text-align: center;
      padding: 3rem;
      color: var(--color-text-muted);
    }

    /* ===== MES ===== */
    .month-card {
      padding: 0.75rem;
    }
    .weekday-row,
    .week-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }
    .weekday-cell {
      padding: 0.5rem;
      text-align: center;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .month-day {
      position: relative;
      min-height: 64px;
      background: transparent;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 0.35rem;
      padding-top: 0.4rem;
      transition: all 0.15s;
      margin: 1px;
      &:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: var(--color-border-highlight);
      }
      &.outside {
        opacity: 0.35;
      }
      &.today {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 1px var(--color-accent);
      }
      &.has-apt {
        background: var(--color-primary-light);
      }
    }
    .day-num {
      font-size: 0.9rem;
      font-weight: 700;
    }
    .day-count {
      font-size: 0.65rem;
      font-weight: 800;
      color: var(--color-primary);
      background: var(--color-primary-light);
      border: 1px solid var(--color-primary);
      border-radius: var(--radius-full);
      padding: 0.05rem 0.4rem;
    }

    /* ===== SEMANA ===== */
    .week-scroll {
      overflow-x: auto;
    }
    .week-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(120px, 1fr));
      gap: 0.5rem;
      min-width: 760px;
    }
    .week-col {
      background: var(--color-surface-glass);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
      &.today .week-col-header {
        background: var(--color-primary-light);
        border-bottom-color: var(--color-primary);
      }
    }
    .week-col-header {
      padding: 0.6rem;
      text-align: center;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid var(--color-border);
    }
    .week-name {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .week-date {
      font-size: 1.15rem;
      font-weight: 800;
      color: #ffffff;
    }
    .week-col-body {
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-height: 120px;
    }
    .no-apt {
      text-align: center;
      color: var(--color-text-dim);
      font-size: 0.75rem;
      padding: 0.75rem 0;
    }

    .apt-chip {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.5rem 0.6rem;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--color-border);
      border-left: 3px solid var(--color-primary);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
      &:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: var(--color-border-highlight);
      }
      strong {
        color: var(--color-primary);
        font-size: 0.7rem;
      }
      span {
        color: var(--color-text);
      }
      small {
        color: var(--color-text-muted);
        font-size: 0.68rem;
      }
      &.wide strong {
        color: var(--color-text);
        font-size: 0.75rem;
      }
      &[data-status='completed'] {
        border-left-color: var(--color-primary);
      }
      &[data-status='canceled'],
      &[data-status='no_show'] {
        border-left-color: var(--color-danger);
      }
      &[data-status='pending'] {
        border-left-color: var(--color-warning);
      }
    }

    /* ===== DÍA ===== */
    .day-card {
      padding: 1rem;
    }
    .day-timeline {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .hour-row {
      display: flex;
      gap: 0.75rem;
      align-items: stretch;
    }
    .hour-label {
      flex-shrink: 0;
      width: 64px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--color-text-muted);
      padding-top: 0.4rem;
      text-align: right;
    }
    .hour-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      border-top: 1px solid var(--color-border);
      padding-top: 0.4rem;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 767px) {
      .header-flex {
        flex-direction: column;
        align-items: stretch;
      }
      .header-actions {
        align-self: flex-start;
      }
      .header-flex .btn-glass {
        align-self: flex-start;
      }
      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }
      .nav-group {
        justify-content: space-between;
      }
      .period-label {
        flex: 1;
        min-width: 0;
      }
      .month-day {
        min-height: 46px;
      }
      .day-num {
        font-size: 0.8rem;
      }
      .hour-label {
        width: 44px;
      }
    }
  `,
})
export class CalendarComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly appointments = signal<AppointmentAdminDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly showCreateModal = signal(false);
  protected readonly selectedAppointment = signal<AppointmentAdminDto | null>(null);
  protected readonly view = signal<CalendarView>('month');
  protected readonly anchor = signal<Date>(new Date());

  protected readonly weekdayNames = WEEKDAY_SHORT;
  protected readonly hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  protected readonly monthWeeks = computed(() =>
    buildMonthGrid(this.anchor(), this.appointments()),
  );
  protected readonly weekDays = computed(() => buildWeekDays(this.anchor()));
  protected readonly dayAppointments = computed(() => this.appointmentsOn(toDayKey(this.anchor())));

  protected readonly periodLabel = computed(() => {
    const a = this.anchor();
    if (this.view() === 'month') {
      return `${MONTH_NAMES[a.getMonth()]} ${a.getFullYear()}`;
    }
    if (this.view() === 'week') {
      const days = buildWeekDays(a);
      const first = days[0];
      const last = days[6];
      const firstLabel = `${first.getDate()} ${MONTH_NAMES[first.getMonth()].slice(0, 3)}`;
      const lastLabel = `${last.getDate()} ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
      return `${firstLabel} – ${lastLabel}`;
    }
    return `${WEEKDAY_FULL[a.getDay()]}, ${a.getDate()} de ${MONTH_NAMES[a.getMonth()].toLowerCase()} de ${a.getFullYear()}`;
  });

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

  setView(v: CalendarView) {
    this.view.set(v);
  }

  prev() {
    if (this.view() === 'month') {
      this.anchor.update((a) => addMonths(a, -1));
    } else if (this.view() === 'week') {
      this.anchor.update((a) => addDays(a, -7));
    } else {
      this.anchor.update((a) => addDays(a, -1));
    }
  }

  next() {
    if (this.view() === 'month') {
      this.anchor.update((a) => addMonths(a, 1));
    } else if (this.view() === 'week') {
      this.anchor.update((a) => addDays(a, 7));
    } else {
      this.anchor.update((a) => addDays(a, 1));
    }
  }

  goToday() {
    this.anchor.set(new Date());
  }

  goDay(date: Date) {
    this.anchor.set(date);
    this.view.set('day');
  }

  isToday(d: Date): boolean {
    return toDayKey(d) === toDayKey(new Date());
  }

  dayKey(d: Date): string {
    return toDayKey(d);
  }

  weekdayShort(d: Date): string {
    return WEEKDAY_SHORT[d.getDay()];
  }

  hourLabel(h: number): string {
    return `${pad(h)}:00`;
  }

  appointmentsOn(key: string): AppointmentAdminDto[] {
    return this.appointments()
      .filter((a) => toDayKey(new Date(a.startAt)) === key)
      .sort((a, b) => a.startAt - b.startAt);
  }

  appointmentsAtHour(h: number): AppointmentAdminDto[] {
    return this.dayAppointments().filter((a) => new Date(a.startAt).getHours() === h);
  }

  onAppointmentCreated() {
    this.showCreateModal.set(false);
    this.loadAppointments();
  }

  openAppointmentDetail(a: AppointmentAdminDto) {
    this.selectedAppointment.set(a);
  }

  onAppointmentChanged() {
    this.selectedAppointment.set(null);
    this.loadAppointments();
  }
}
