import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ThemeService, BooklyTheme } from '../../core/theme/theme.service';
import type {
  PublicCompanyDto,
  PublicServiceDto,
  PublicStaffDto,
  SlotDto,
  CreateBookingDto,
} from '@bookly/contracts';

interface CalendarDay {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  dayName: string;
  isPast: boolean;
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
          <div class="step-node" [class.active]="currentStep() === 1" [class.done]="currentStep() > 1">
            <div class="node-icon">{{ currentStep() > 1 ? '✓' : '1' }}</div>
            <span>Servicio</span>
          </div>
          <div class="step-line"></div>
          <div class="step-node" [class.active]="currentStep() === 2" [class.done]="currentStep() > 2">
            <div class="node-icon">{{ currentStep() > 2 ? '✓' : '2' }}</div>
            <span>Especialista</span>
          </div>
          <div class="step-line"></div>
          <div class="step-node" [class.active]="currentStep() === 3" [class.done]="currentStep() > 3">
            <div class="node-icon">{{ currentStep() > 3 ? '✓' : '3' }}</div>
            <span>Horario</span>
          </div>
          <div class="step-line"></div>
          <div class="step-node" [class.active]="currentStep() === 4" [class.done]="currentStep() > 4">
            <div class="node-icon">{{ currentStep() > 4 ? '✓' : '4' }}</div>
            <span>Datos</span>
          </div>
        </nav>

        <!-- Main Step Content -->
        <main class="step-body">
          
          <!-- STEP 1: SERVICIO -->
          @if (currentStep() === 1) {
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

          <!-- STEP 2: ESPECIALISTA -->
          @if (currentStep() === 2) {
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

          <!-- STEP 3: CALENDARIO Y SLOTS -->
          @if (currentStep() === 3) {
            <section class="step-section">
              <h2 class="section-title">Elige Fecha y Horario</h2>
              <p class="section-desc">Disponibilidad calculada en tiempo real por el Slot Engine</p>

              <!-- Selector de Días -->
              <div class="days-scroll-container">
                @for (day of calendarDays(); track day.dateStr) {
                  <button
                    type="button"
                    class="day-pill"
                    [class.active]="selectedDate() === day.dateStr"
                    (click)="selectDate(day.dateStr)"
                  >
                    <span class="day-name">{{ day.dayName }}</span>
                    <span class="day-num">{{ day.dayNumber }}</span>
                  </button>
                }
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

          <!-- STEP 4: DATOS DEL CLIENTE -->
          @if (currentStep() === 4) {
            <section class="step-section">
              <h2 class="section-title">Tus Datos de Contacto</h2>
              <p class="section-desc">Confirmación instantánea sin crear contraseñas</p>

              <!-- Resumen de Cita -->
              <div class="summary-box">
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
              </form>
            </section>
          }

          <!-- CONFIRMACIÓN DE ÉXITO -->
          @if (currentStep() === 5) {
            <section class="success-section">
              <div class="beacon-glow">✓</div>
              <h2>¡Cita Confirmada con Éxito!</h2>
              <p class="success-desc">
                Te enviamos un correo electrónico con los detalles y el archivo de Google/Apple Calendar.
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
        @if (currentStep() <= 4) {
          <footer class="wizard-footer">
            <button
              type="button"
              class="btn-secondary"
              [style.visibility]="currentStep() > 1 ? 'visible' : 'hidden'"
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
              {{ currentStep() === 4 ? (submitting() ? 'Confirmando...' : 'Confirmar Reserva ✨') : 'Continuar →' }}
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
    .days-scroll-container {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .day-pill {
      min-width: 60px;
      padding: 0.6rem 0.4rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      cursor: pointer;
      transition: all 0.15s;
      &.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
        box-shadow: var(--shadow-glow);
      }
    }
    .day-name { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); }
    .day-num { font-size: 1rem; font-weight: 800; }
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
  protected readonly services = signal<PublicServiceDto[]>([]);
  protected readonly staffList = signal<PublicStaffDto[]>([]);
  protected readonly availableSlots = signal<SlotDto[]>([]);

  protected readonly currentStep = signal<number>(1);
  protected readonly selectedService = signal<PublicServiceDto | null>(null);
  protected readonly selectedStaff = signal<PublicStaffDto | null>(null);
  protected readonly selectedDate = signal<string>('');
  protected readonly selectedSlot = signal<SlotDto | null>(null);

  protected readonly loading = signal(true);
  protected readonly loadingSlots = signal(false);
  protected readonly submitting = signal(false);
  protected readonly confirmedAppointment = signal<{ appointmentId: number; customerName: string; serviceName: string } | null>(null);

  protected customerName = '';
  protected customerPhone = '';
  protected customerEmail = '';

  protected readonly calendarDays = computed(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNumber: d.getDate(),
        dayName: dayNames[d.getDay()],
        isPast: false,
      });
    }
    return days;
  });

  protected readonly canProceed = computed(() => {
    switch (this.currentStep()) {
      case 1: return !!this.selectedService();
      case 2: return true; // null significa "cualquiera"
      case 3: return !!this.selectedSlot();
      case 4: return this.customerName.trim().length >= 2 && this.customerPhone.trim().length >= 8 && this.customerEmail.includes('@');
      default: return true;
    }
  });

  ngOnInit() {
    const routeSlug = this.route.snapshot.paramMap.get('slug') || 'demo';
    this.slug.set(routeSlug);
    this.loadInitialData(routeSlug);
  }

  private loadInitialData(slug: string) {
    this.loading.set(true);
    this.api.getCompany(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.company.set(res.data);
          this.themeService.initFromCompany(res.data.theme);
          this.loadServicesAndStaff(slug);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private loadServicesAndStaff(slug: string) {
    this.api.getServices(slug).subscribe({
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

    // Default select today
    const firstDay = this.calendarDays()[0];
    if (firstDay) {
      this.selectedDate.set(firstDay.dateStr);
    }
  }

  changeTheme(theme: BooklyTheme) {
    this.themeService.setTheme(theme);
  }

  selectService(service: PublicServiceDto) {
    this.selectedService.set(service);
  }

  selectStaff(staff: PublicStaffDto | null) {
    this.selectedStaff.set(staff);
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
    this.api.getAvailability(this.slug(), srv.id, date, this.selectedStaff()?.id).subscribe({
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
    if (this.currentStep() === 2) {
      this.fetchSlots();
    }

    if (this.currentStep() === 4) {
      this.submitBooking();
      return;
    }

    this.currentStep.update((s) => s + 1);
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
    }
  }

  submitBooking() {
    const srv = this.selectedService();
    const slot = this.selectedSlot();
    if (!srv || !slot) return;

    const payload: CreateBookingDto = {
      serviceId: srv.id,
      staffId: this.selectedStaff()?.id ?? null,
      startAt: slot.startAt,
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      customerEmail: this.customerEmail,
    };

    this.submitting.set(true);
    this.api.createBooking(this.slug(), payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success && res.data) {
          this.confirmedAppointment.set(res.data);
          this.currentStep.set(5);
        }
      },
      error: () => {
        this.submitting.set(false);
      }
    });
  }

  resetWizard() {
    this.currentStep.set(1);
    this.selectedSlot.set(null);
    this.confirmedAppointment.set(null);
  }
}
