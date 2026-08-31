import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ThemeService, BooklyTheme } from '../../core/theme/theme.service';
import type {
  PublicCompanyDto,
  PublicLocationDto,
  PublicServiceDto,
  PublicStaffDto,
  SlotDto,
  CreateBookingDto,
} from '@bookly/contracts';

interface ClientCalendarDay {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
}

type WizardStep = 'location' | 'service' | 'staff' | 'datetime' | 'data';

interface BookingConfirmation {
  appointmentId: number;
  status: string;
  customerName: string;
  serviceName: string;
}

const STEP_LABELS: Record<WizardStep, string> = {
  location: 'Ubicación',
  service: 'Servicio',
  staff: 'Especialista',
  datetime: 'Horario',
  data: 'Datos',
};

const CLIENT_MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const CLIENT_WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStrInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function shiftMonth(c: { year: number; month: number }, delta: number): { year: number; month: number } {
  const d = new Date(c.year, c.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function buildClientCalendar(cursor: { year: number; month: number }, todayStr: string): (ClientCalendarDay | null)[] {
  const first = new Date(cursor.year, cursor.month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (ClientCalendarDay | null)[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${cursor.year}-${pad2(cursor.month + 1)}-${pad2(day)}`;
    cells.push({
      dateStr,
      dayNumber: day,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  while (cells.length < 42) {
    cells.push(null);
  }
  return cells;
}

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wizard-shell">
      <div class="dark-glass-card">

        <!-- Tenant Hero Header -->
        <header class="tenant-hero">
          <div class="theme-quick-switch">
            <button (click)="changeTheme('midnight-emerald')" [class.active]="themeService.currentTheme() === 'midnight-emerald'" title="Midnight Emerald">🌿</button>
            <button (click)="changeTheme('obsidian-luxe')" [class.active]="themeService.currentTheme() === 'obsidian-luxe'" title="Obsidian Luxe">💎</button>
            <button (click)="changeTheme('titanium-oled')" [class.active]="themeService.currentTheme() === 'titanium-oled'" title="Titanium OLED">⚡</button>
          </div>

          @if (company(); as comp) {
            <div class="tenant-badge-glow">🦷</div>
            <h1>{{ comp.name }}</h1>
            <p>Portal Oficial de Agendamiento en Línea</p>
          } @else if (loading()) {
            <div class="skeleton-header">Cargando datos de la empresa...</div>
          }
        </header>

        <!-- Stepper Indicators -->
        <nav class="stepper-bar">
          @for (step of stepOrder(); track step; let i = $index; let last = $last) {
            <div class="step-node" [class.active]="currentIndex() === i" [class.done]="currentIndex() > i">
              <div class="node-icon">{{ currentIndex() > i ? '✓' : (i + 1) }}</div>
              <span>{{ stepLabel(step) }}</span>
            </div>
            @if (!last) {
              <div class="step-line"></div>
            }
          }
        </nav>

        <!-- Main Step Content -->
        <main class="step-body">

          @if (!isSuccess()) {
            @switch (currentStep()) {
              <!-- STEP: UBICACIÓN -->
              @case ('location') {
                <section class="step-section">
                  <h2 class="section-title">Elige tu Ubicación</h2>
                  <p class="section-desc">Selecciona dónde deseas recibir la atención</p>

                  <div class="card-list">
                    @for (location of locations(); track location.id) {
                      <div
                        class="option-card"
                        [class.selected]="selectedLocation()?.id === location.id"
                        (click)="selectLocation(location)"
                      >
                        <div class="option-info">
                          <h3>{{ location.name }}</h3>
                          <p>
                            <span class="location-type-badge" [class.mobile]="location.type === 'mobile'">
                              {{ location.type === 'mobile' ? '🚗 A domicilio' : '📍 En tu local' }}
                            </span>
                            @if (location.address) { · {{ location.address }} }
                            @if (location.serviceRadiusKm) { · Hasta {{ location.serviceRadiusKm }} km }
                          </p>
                        </div>
                      </div>
                    } @empty {
                      <div class="empty-msg">No hay ubicaciones disponibles.</div>
                    }
                  </div>
                </section>
              }

              <!-- STEP: SERVICIO -->
              @case ('service') {
                <section class="step-section">
                  <h2 class="section-title">Selecciona un Servicio</h2>
                  <p class="section-desc">Elige el servicio que deseas agendar para continuar</p>

                  <div class="card-list">
                    @for (service of services(); track service.id) {
                      <div
                        class="option-card"
                        [class.selected]="selectedService()?.id === service.id"
                        (click)="selectService(service)"
                      >
                        <div class="option-info">
                          <h3>{{ service.name }}</h3>
                          <p>⏱ {{ service.durationMinutes }} min · {{ service.description || 'Atención profesional' }}</p>
                        </div>
                        <div class="option-price">
                          Q{{ (service.priceQtz / 100).toFixed(2) }}
                        </div>
                      </div>
                    } @empty {
                      <div class="empty-msg">No hay servicios disponibles en este momento.</div>
                    }
                  </div>
                </section>
              }

              <!-- STEP: ESPECIALISTA -->
              @case ('staff') {
                <section class="step-section">
                  <h2 class="section-title">¿Quién deseas que te atienda?</h2>
                  <p class="section-desc">Selecciona un profesional o elige el horario más próximo</p>

                  <div class="card-list">
                    <!-- Opción Cualquiera disponible -->
                    <div
                      class="option-card"
                      [class.selected]="selectedStaff() === null"
                      (click)="selectStaff(null)"
                    >
                      <div class="staff-flex">
                        <div class="staff-avatar-glow">⚡</div>
                        <div class="option-info">
                          <h3>Cualquiera disponible</h3>
                          <p>Recomendado · Acceso a horarios más próximos</p>
                        </div>
                      </div>
                    </div>

                    @for (member of staffList(); track member.id) {
                      <div
                        class="option-card"
                        [class.selected]="selectedStaff()?.id === member.id"
                        (click)="selectStaff(member)"
                      >
                        <div class="staff-flex">
                          <div class="staff-avatar-glow">👨‍⚕️</div>
                          <div class="option-info">
                            <h3>{{ member.name }}</h3>
                            <p>Especialista en atención personalizada</p>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </section>
              }

              <!-- STEP: CALENDARIO Y SLOTS -->
              @case ('datetime') {
                <section class="step-section">
                  <h2 class="section-title">Elige Fecha y Horario</h2>
                  <p class="section-desc">Disponibilidad calculada en tiempo real por el Slot Engine</p>

                  <!-- Calendario Mensual -->
                  <div class="calendar-box">
                    <div class="calendar-header">
                      <button type="button" class="cal-nav" (click)="prevMonth()" aria-label="Mes anterior">‹</button>
                      <span class="calendar-month">{{ monthLabel() }}</span>
                      <button type="button" class="cal-nav" (click)="nextMonth()" aria-label="Mes siguiente">›</button>
                    </div>
                    <div class="calendar-weekdays">
                      @for (w of weekdayHeader; track w) {
                        <span class="cal-weekday">{{ w }}</span>
                      }
                    </div>
                    <div class="calendar-grid">
                      @for (cell of calendarCells(); track $index) {
                        @if (cell) {
                          <button
                            type="button"
                            class="calendar-day"
                            [class.selected]="selectedDate() === cell.dateStr"
                            [class.today]="cell.isToday"
                            [class.is-past]="cell.isPast"
                            [disabled]="cell.isPast"
                            (click)="selectDate(cell.dateStr)"
                          >{{ cell.dayNumber }}</button>
                        } @else {
                          <span class="calendar-day empty"></span>
                        }
                      }
                    </div>
                  </div>

                  <!-- Lista de Slots -->
                  <label class="slot-label">Horarios disponibles:</label>
                  @if (loadingSlots()) {
                    <div class="empty-msg">Consultando disponibilidad...</div>
                  } @else {
                    <div class="slots-grid">
                      @for (slot of availableSlots(); track slot.startAt) {
                        <button
                          type="button"
                          class="slot-btn"
                          [class.active]="selectedSlot()?.startAt === slot.startAt"
                          (click)="selectSlot(slot)"
                        >
                          {{ slot.startAt | date:'shortTime' }}
                        </button>
                      } @empty {
                        <div class="empty-msg col-span-3">No hay horarios libres para esta fecha. Intenta otro día.</div>
                      }
                    </div>
                  }
                </section>
              }

              <!-- STEP: DATOS DEL CLIENTE -->
              @case ('data') {
                <section class="step-section">
                  <h2 class="section-title">Tus Datos de Contacto</h2>
                  <p class="section-desc">
                    {{ isMobileLocation() ? 'Solicitud sujeta a confirmación del negocio' : 'Confirmación instantánea sin crear contraseñas' }}
                  </p>

                  <!-- Resumen de Cita -->
                  <div class="summary-box">
                    @if (selectedLocation()) {
                      <div class="sum-row">
                        <span>Ubicación:</span>
                        <strong>{{ selectedLocation()?.name }}</strong>
                      </div>
                    }
                    <div class="sum-row">
                      <span>Servicio:</span>
                      <strong>{{ selectedService()?.name }}</strong>
                    </div>
                    <div class="sum-row">
                      <span>Especialista:</span>
                      <strong>{{ selectedStaff() ? selectedStaff()?.name : 'Cualquiera disponible' }}</strong>
                    </div>
                    <div class="sum-row">
                      <span>Fecha y Hora:</span>
                      <strong>{{ selectedSlot()?.startAt | date:'medium' }}</strong>
                    </div>
                    <div class="sum-row total">
                      <span>Total:</span>
                      <span>Q{{ ((selectedService()?.priceQtz || 0) / 100).toFixed(2) }}</span>
                    </div>
                  </div>

                  <!-- Formulario -->
                  <form class="contact-form">
                    <div class="form-field">
                      <label>Nombre y Apellido *</label>
                      <input type="text" [(ngModel)]="customerName" name="name" placeholder="Ej. Juan Pérez" required />
                    </div>
                    <div class="form-field">
                      <label>WhatsApp / Teléfono Móvil *</label>
                      <input type="tel" [(ngModel)]="customerPhone" name="phone" placeholder="+502 0000-0000" required />
                    </div>
                    <div class="form-field">
                      <label>Correo Electrónico *</label>
                      <input type="email" [(ngModel)]="customerEmail" name="email" placeholder="correo@ejemplo.com" required />
                    </div>
                    @if (isMobileLocation()) {
                      <div class="form-field">
                        <label>Dirección de destino (A domicilio) *</label>
                        <input type="text" [(ngModel)]="customerAddress" name="address" placeholder="Calle, zona, referencias..." required />
                      </div>
                    }
                  </form>
                </section>
              }
            }
          } @else {
            <!-- CONFIRMACIÓN DE ÉXITO -->
            <section class="success-section">
              <div class="beacon-glow">{{ confirmedAppointment()?.status === 'pending' ? '⏳' : '✓' }}</div>
              <h2>{{ confirmedAppointment()?.status === 'pending' ? '¡Solicitud Recibida!' : '¡Cita Confirmada con Éxito!' }}</h2>
              <p class="success-desc">
                @if (confirmedAppointment()?.status === 'pending') {
                  Tu solicitud fue enviada. El negocio confirmará el horario y te contactará por WhatsApp/correo.
                } @else {
                  Te enviamos un correo electrónico con los detalles y el archivo de Google/Apple Calendar.
                }
              </p>

              <div class="summary-box">
                <div class="sum-row">
                  <span>Código de Reserva:</span>
                  <strong class="code-highlight">#BK-{{ confirmedAppointment()?.appointmentId }}</strong>
                </div>
                <div class="sum-row">
                  <span>Paciente:</span>
                  <strong>{{ confirmedAppointment()?.customerName }}</strong>
                </div>
                <div class="sum-row">
                  <span>Servicio:</span>
                  <strong>{{ confirmedAppointment()?.serviceName }}</strong>
                </div>
              </div>

              <button type="button" (click)="resetWizard()" class="btn-primary full-width">
                Hacer otra reserva
              </button>
            </section>
          }

        </main>

        <!-- Footer Actions -->
        @if (!isSuccess()) {
          <footer class="wizard-footer">
            <button
              type="button"
              class="btn-secondary"
              [style.visibility]="currentIndex() > 0 ? 'visible' : 'hidden'"
              (click)="prevStep()"
            >
              ← Anterior
            </button>

            <button
              type="button"
              class="btn-primary"
              [disabled]="!canProceed()"
              (click)="nextStep()"
            >
              {{ primaryActionLabel() }}
            </button>
          </footer>
        }

      </div>
    </div>
  `,
  styles: [`
    .wizard-shell {
      display: flex;
      justify-content: center;
      padding: 2rem 1rem;
      min-height: 100vh;
    }
    .dark-glass-card {
      width: 100%;
      max-width: 500px;
      background: var(--color-surface-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .tenant-hero {
      padding: 2rem 1.5rem 1.25rem 1.5rem;
      text-align: center;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
      border-bottom: 1px solid var(--color-border);
      position: relative;
      h1 { font-size: 1.35rem; font-weight: 800; color: #ffffff; margin-bottom: 0.25rem; }
      p { font-size: 0.85rem; color: var(--color-text-muted); }
    }
    .theme-quick-switch {
      position: absolute;
      top: 0.85rem;
      right: 1rem;
      display: flex;
      gap: 0.3rem;
      background: rgba(0, 0, 0, 0.3);
      padding: 0.2rem;
      border-radius: var(--radius-full);
      border: 1px solid var(--color-border);
      button {
        background: transparent;
        border: none;
        font-size: 0.75rem;
        cursor: pointer;
        padding: 0.2rem 0.4rem;
        border-radius: var(--radius-full);
        opacity: 0.6;
        transition: all 0.15s;
        &.active, &:hover { opacity: 1; background: rgba(255, 255, 255, 0.1); }
      }
    }
    .tenant-badge-glow {
      width: 54px;
      height: 54px;
      background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-hover) 100%);
      border: 1px solid var(--color-border-highlight);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.65rem;
      margin: 0 auto 0.75rem auto;
      box-shadow: var(--shadow-glow);
    }
    .stepper-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1.5rem;
      background: rgba(0,0,0,0.2);
      border-bottom: 1px solid var(--color-border);
    }
    .step-node {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-dim);
      &.active {
        color: #ffffff;
        .node-icon { background: var(--color-primary); color: white; border-color: var(--color-primary); box-shadow: var(--shadow-glow); }
      }
      &.done {
        color: var(--color-success);
        .node-icon { background: var(--color-success-bg); color: var(--color-success); border-color: var(--color-success); }
      }
    }
    .node-icon {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-full);
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .step-line {
      flex: 1;
      height: 1px;
      background: var(--color-border);
      margin: 0 0.4rem;
    }
    .step-body {
      padding: 1.75rem 1.5rem;
      flex: 1;
    }
    .section-title { font-size: 1.15rem; font-weight: 700; color: #ffffff; margin-bottom: 0.25rem; }
    .section-desc { font-size: 0.825rem; color: var(--color-text-muted); margin-bottom: 1.25rem; }
    .card-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .option-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      &:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: var(--color-border-highlight);
        transform: translateY(-1px);
      }
      &.selected {
        background: var(--color-primary-light);
        border-color: var(--color-primary);
        box-shadow: 0 0 0 1px var(--color-primary), var(--shadow-glow);
      }
    }
    .option-info {
      h3 { font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-bottom: 0.2rem; }
      p { font-size: 0.8rem; color: var(--color-text-muted); }
    }
    .option-price { font-size: 1.05rem; font-weight: 800; color: var(--color-primary); }
    .location-type-badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-full);
      font-size: 0.72rem;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--color-border-highlight);
      color: var(--color-text);
      &.mobile {
        background: var(--color-accent-bg, rgba(56, 189, 248, 0.12));
        border-color: rgba(56, 189, 248, 0.35);
        color: var(--color-accent, #38bdf8);
      }
    }
    .staff-flex { display: flex; align-items: center; gap: 0.85rem; }
    .staff-avatar-glow {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-full);
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }
    .calendar-box {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.85rem;
      margin-bottom: 1.25rem;
    }
    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .cal-nav {
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--color-border);
      color: var(--color-text);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 1.1rem;
      line-height: 1;
      transition: all 0.15s;
      &:hover { background: rgba(255, 255, 255, 0.1); }
    }
    .calendar-month {
      font-weight: 800;
      color: #ffffff;
      font-size: 0.95rem;
    }
    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      margin-bottom: 0.3rem;
    }
    .cal-weekday {
      text-align: center;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-text-muted);
      padding: 0.3rem 0;
    }
    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.25rem;
    }
    .calendar-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--color-text);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      &:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); border-color: var(--color-border-highlight); }
      &.today { border-color: var(--color-accent); }
      &.selected {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
        box-shadow: var(--shadow-glow);
      }
      &.is-past { opacity: 0.3; cursor: not-allowed; }
      &.empty { background: transparent; border: none; pointer-events: none; }
    }
    .slot-label { font-size: 0.825rem; font-weight: 700; color: #ffffff; margin-bottom: 0.5rem; display: block; }
    .slots-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      max-height: 180px;
      overflow-y: auto;
    }
    .slot-btn {
      padding: 0.65rem 0.3rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      color: var(--color-text);
      font-size: 0.825rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      &:hover { border-color: var(--color-primary); color: var(--color-primary); }
      &.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
        box-shadow: var(--shadow-glow);
      }
    }
    .summary-box {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1rem;
      margin-bottom: 1.25rem;
    }
    .sum-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.825rem;
      margin-bottom: 0.5rem;
      color: var(--color-text-muted);
      strong { color: #ffffff; }
      &.total {
        margin-bottom: 0;
        padding-top: 0.5rem;
        border-top: 1px solid var(--color-border);
        font-weight: 800;
        font-size: 1rem;
        color: var(--color-primary);
      }
    }
    .contact-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      label { font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); }
      input {
        padding: 0.75rem 0.9rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: white;
        outline: none;
        font-size: 0.875rem;
        &:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-glow); }
      }
    }
    .wizard-footer {
      padding: 1rem 1.5rem;
      background: rgba(0, 0, 0, 0.2);
      border-top: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-primary {
      background: var(--color-primary);
      color: white;
      border: none;
      padding: 0.7rem 1.5rem;
      border-radius: var(--radius-md);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: var(--shadow-glow);
      transition: all 0.15s;
      &:hover:not(:disabled) { background: var(--color-primary-hover); transform: translateY(-1px); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &.full-width { width: 100%; margin-top: 1rem; }
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--color-border);
      color: var(--color-text);
      padding: 0.7rem 1.25rem;
      border-radius: var(--radius-md);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .success-section { text-align: center; padding: 1.5rem 0.5rem; }
    .beacon-glow {
      width: 64px;
      height: 64px;
      background: var(--color-success-bg);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--color-success);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      margin: 0 auto 1rem auto;
      box-shadow: 0 0 25px var(--color-success-bg);
    }
    .code-highlight { color: var(--color-accent); }
    .empty-msg { text-align: center; padding: 2rem; color: var(--color-text-muted); font-size: 0.85rem; }
  `]
})
export class BookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  protected readonly themeService = inject(ThemeService);

  protected readonly slug = signal<string>('demo');
  protected readonly company = signal<PublicCompanyDto | null>(null);
  protected readonly locations = signal<PublicLocationDto[]>([]);
  protected readonly selectedLocation = signal<PublicLocationDto | null>(null);
  protected readonly services = signal<PublicServiceDto[]>([]);
  protected readonly staffList = signal<PublicStaffDto[]>([]);
  protected readonly availableSlots = signal<SlotDto[]>([]);

  protected readonly currentIndex = signal<number>(0);
  protected readonly selectedService = signal<PublicServiceDto | null>(null);
  protected readonly selectedStaff = signal<PublicStaffDto | null>(null);
  protected readonly selectedDate = signal<string>('');
  protected readonly selectedSlot = signal<SlotDto | null>(null);
  protected readonly timezone = signal<string>('UTC');
  protected readonly monthCursor = signal<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  protected readonly loading = signal(true);
  protected readonly loadingSlots = signal(false);
  protected readonly submitting = signal(false);
  protected readonly confirmedAppointment = signal<BookingConfirmation | null>(null);

  protected customerName = '';
  protected customerPhone = '';
  protected customerEmail = '';
  protected customerAddress = '';

  protected readonly weekdayHeader = CLIENT_WEEKDAYS;

  protected readonly needsLocationStep = computed(() => this.locations().length > 1);
  protected readonly isMobileLocation = computed(() => this.selectedLocation()?.type === 'mobile');

  protected readonly stepOrder = computed<WizardStep[]>(() => {
    const steps: WizardStep[] = [];
    if (this.needsLocationStep()) {
      steps.push('location');
    }
    steps.push('service', 'staff', 'datetime', 'data');
    return steps;
  });

  protected readonly currentStep = computed<WizardStep | null>(() =>
    this.stepOrder()[this.currentIndex()] ?? null,
  );

  protected readonly isSuccess = computed(() => this.currentIndex() >= this.stepOrder().length);

  protected readonly todayStr = computed(() =>
    toDateStrInTz(new Date(), this.timezone()),
  );

  protected readonly monthLabel = computed(() => {
    const c = this.monthCursor();
    return `${CLIENT_MONTH_NAMES[c.month]} ${c.year}`;
  });

  protected readonly calendarCells = computed(() =>
    buildClientCalendar(this.monthCursor(), this.todayStr()),
  );

  protected readonly canProceed = computed(() => {
    switch (this.currentStep()) {
      case 'location': return !!this.selectedLocation();
      case 'service': return !!this.selectedService();
      case 'staff': return true; // null significa "cualquiera"
      case 'datetime': return !!this.selectedSlot();
      case 'data':
        return this.customerName.trim().length >= 2
          && this.customerPhone.trim().length >= 8
          && this.customerEmail.includes('@')
          && (!this.isMobileLocation() || this.customerAddress.trim().length >= 5);
      default: return true;
    }
  });

  protected readonly primaryActionLabel = computed(() => {
    if (this.currentStep() !== 'data') {
      return 'Continuar →';
    }
    if (this.submitting()) {
      return 'Confirmando...';
    }
    return this.isMobileLocation() ? 'Enviar Solicitud ✨' : 'Confirmar Reserva ✨';
  });

  ngOnInit() {
    const routeSlug = this.route.snapshot.paramMap.get('slug') || 'demo';
    this.slug.set(routeSlug);
    this.loadInitialData(routeSlug);
  }

  protected stepLabel(step: WizardStep): string {
    return STEP_LABELS[step];
  }

  private loadInitialData(slug: string) {
    this.loading.set(true);
    this.api.getCompany(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.company.set(res.data);
          this.themeService.initFromCompany(res.data.theme);
          this.timezone.set(res.data.timezone);
          const todayStr = toDateStrInTz(new Date(), res.data.timezone);
          const [year, month] = todayStr.split('-').map((n) => Number(n));
          this.monthCursor.set({ year, month: month - 1 });
          this.selectedDate.set(todayStr);
          this.loadLocations(slug);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private loadLocations(slug: string) {
    this.api.getPublicLocations(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.locations.set(res.data);
          // Con una única ubicación se usa por defecto sin mostrar el paso.
          if (res.data.length === 1) {
            this.selectedLocation.set(res.data[0]);
          }
        }
        this.loadServicesAndStaff(slug);
      },
      error: () => {
        // Si el endpoint no existe, el wizard sigue funcionando sin paso de ubicación.
        this.loadServicesAndStaff(slug);
      }
    });
  }

  private loadServicesAndStaff(slug: string) {
    this.api.getServices(slug, this.selectedLocation()?.id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.services.set(res.data);
          if (res.data.length > 0) {
            this.selectedService.set(res.data[0]);
          }
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.api.getStaff(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.staffList.set(res.data);
        }
      }
    });
  }

  changeTheme(theme: BooklyTheme) {
    this.themeService.setTheme(theme);
  }

  selectLocation(location: PublicLocationDto) {
    if (this.selectedLocation()?.id === location.id) {
      return;
    }
    this.selectedLocation.set(location);
    // Reiniciar dependencias al cambiar de ubicación y recargar servicios.
    this.selectedService.set(null);
    this.selectedStaff.set(null);
    this.selectedSlot.set(null);
    this.availableSlots.set([]);
    this.services.set([]);
    this.loadServicesAndStaff(this.slug());
  }

  selectService(service: PublicServiceDto) {
    this.selectedService.set(service);
  }

  selectStaff(staff: PublicStaffDto | null) {
    this.selectedStaff.set(staff);
  }

  prevMonth() {
    this.monthCursor.update((c) => shiftMonth(c, -1));
  }

  nextMonth() {
    this.monthCursor.update((c) => shiftMonth(c, 1));
  }

  selectDate(dateStr: string) {
    this.selectedDate.set(dateStr);
    this.fetchSlots();
  }

  selectSlot(slot: SlotDto) {
    this.selectedSlot.set(slot);
  }

  fetchSlots() {
    const srv = this.selectedService();
    const date = this.selectedDate();
    if (!srv || !date) return;

    this.loadingSlots.set(true);
    this.api.getAvailability(
      this.slug(),
      srv.id,
      date,
      this.selectedStaff()?.id,
      this.selectedLocation()?.id,
    ).subscribe({
      next: (res) => {
        if (res.success && res.data?.slots) {
          this.availableSlots.set(res.data.slots);
          if (res.data.slots.length > 0) {
            this.selectedSlot.set(res.data.slots[0]);
          } else {
            this.selectedSlot.set(null);
          }
        }
        this.loadingSlots.set(false);
      },
      error: () => {
        this.loadingSlots.set(false);
      }
    });
  }

  nextStep() {
    if (this.currentStep() === 'staff') {
      this.fetchSlots();
    }

    if (this.currentStep() === 'data') {
      this.submitBooking();
      return;
    }

    this.currentIndex.update((i) => i + 1);
  }

  prevStep() {
    if (this.currentIndex() > 0) {
      this.currentIndex.update((i) => i - 1);
    }
  }

  submitBooking() {
    const srv = this.selectedService();
    const slot = this.selectedSlot();
    if (!srv || !slot) return;

    const payload: CreateBookingDto = {
      serviceId: srv.id,
      staffId: this.selectedStaff()?.id ?? null,
      locationId: this.selectedLocation()?.id ?? null,
      startAt: slot.startAt,
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      customerEmail: this.customerEmail,
      customerAddress: this.isMobileLocation() ? this.customerAddress : undefined,
    };

    this.submitting.set(true);
    this.api.createBooking(this.slug(), payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success && res.data) {
          this.confirmedAppointment.set(res.data);
          this.currentIndex.set(this.stepOrder().length);
        }
      },
      error: () => {
        this.submitting.set(false);
      }
    });
  }

  resetWizard() {
    this.currentIndex.set(0);
    this.selectedSlot.set(null);
    this.confirmedAppointment.set(null);
  }
}
