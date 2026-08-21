import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import type { ServiceResponseDto, CreateServiceDto } from '@bookly/contracts';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-shell">
      <header class="header-flex">
        <div>
          <h1>Catálogo de Servicios</h1>
          <p class="subtitle">Configura los servicios ofrecidos, duración y precios</p>
        </div>
        <button (click)="openModal()" class="btn-primary-glow">+ Nuevo Servicio</button>
      </header>

      @if (loading()) {
        <div class="state-box">Cargando catálogo...</div>
      } @else {
        <div class="services-grid">
          @for (service of services(); track service.id) {
            <div class="service-dark-card">
              <div class="card-head">
                <h3>{{ service.name }}</h3>
                <span class="price-badge">Q{{ (service.priceQtz / 100).toFixed(2) }}</span>
              </div>
              <p class="desc-text">{{ service.description || 'Sin descripción detallada' }}</p>
              <div class="card-foot">
                <span class="meta-tag">⏱ {{ service.durationMinutes }} min (+{{ service.bufferAfterMinutes }} min buffer)</span>
                <span class="status-indicator" [class.active]="service.isActive">
                  {{ service.isActive ? '● Activo' : '○ Inactivo' }}
                </span>
              </div>
            </div>
          } @empty {
            <div class="empty-state">No hay servicios configurados aún. ¡Crea el primero!</div>
          }
        </div>
      }

      @if (showModal()) {
        <div class="dark-modal-backdrop">
          <div class="dark-modal-card">
            <h2>Crear Nuevo Servicio</h2>
            <form (ngSubmit)="saveService()" class="service-form">
              <div class="form-group">
                <label>Nombre del servicio *</label>
                <input [(ngModel)]="form.name" name="name" required placeholder="Ej. Limpieza Dental Profunda" />
              </div>

              <div class="form-group">
                <label>Descripción</label>
                <textarea [(ngModel)]="form.description" name="description" rows="2" placeholder="Detalles del tratamiento..."></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Duración (min) *</label>
                  <input type="number" [(ngModel)]="form.durationMinutes" name="duration" required min="5" />
                </div>
                <div class="form-group">
                  <label>Buffer posterior (min)</label>
                  <input type="number" [(ngModel)]="form.bufferAfterMinutes" name="buffer" min="0" />
                </div>
              </div>

              <div class="form-group">
                <label>Precio (Quetzales) *</label>
                <input type="number" [(ngModel)]="priceInput" name="price" required min="0" step="0.5" />
              </div>

              <div class="modal-actions">
                <button type="button" (click)="closeModal()" class="btn-cancel">Cancelar</button>
                <button type="submit" class="btn-primary-glow">Guardar Servicio</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-shell { display: flex; flex-direction: column; gap: 1.5rem; }
    .header-flex { display: flex; justify-content: space-between; align-items: center; h1 { font-size: 1.5rem; font-weight: 800; color: #fff; } .subtitle { color: var(--color-text-muted); font-size: 0.875rem; } }
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
      &:hover { background: var(--color-primary-hover); transform: translateY(-1px); }
    }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
    }
    .service-dark-card {
      background: var(--color-surface-glass);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.35rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: var(--shadow-card);
      transition: all 0.2s;
      &:hover { border-color: var(--color-border-highlight); transform: translateY(-2px); }
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      h3 { font-size: 1.1rem; font-weight: 700; color: #fff; }
      .price-badge { font-weight: 800; font-size: 1.05rem; color: var(--color-primary); }
    }
    .desc-text { color: var(--color-text-muted); font-size: 0.825rem; flex: 1; line-height: 1.4; }
    .card-foot {
      border-top: 1px solid var(--color-border);
      padding-top: 0.85rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
    }
    .meta-tag { color: var(--color-text-dim); }
    .status-indicator {
      font-weight: 700;
      color: var(--color-danger);
      &.active { color: var(--color-success); }
    }
    .dark-modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }
    .dark-modal-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border-highlight);
      padding: 2rem;
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 480px;
      box-shadow: var(--shadow-card);
      h2 { font-size: 1.25rem; font-weight: 800; color: #fff; margin-bottom: 1.25rem; }
    }
    .service-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      label { font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); }
      input, textarea {
        padding: 0.75rem 0.9rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: white;
        font-family: inherit;
        font-size: 0.875rem;
        outline: none;
        &:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-glow); }
      }
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .btn-cancel {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text);
      padding: 0.65rem 1.25rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 600;
      &:hover { background: rgba(255, 255, 255, 0.05); }
    }
    .state-box, .empty-state { text-align: center; padding: 3rem; color: var(--color-text-muted); }
  `]
})
export class ServicesComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly services = signal<ServiceResponseDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly showModal = signal(false);

  protected priceInput = 150;
  protected form: CreateServiceDto = {
    name: '',
    description: '',
    durationMinutes: 30,
    bufferAfterMinutes: 0,
    priceQtz: 15000,
    isActive: true,
    displayOrder: 0,
  };

  ngOnInit() {
    this.loadServices();
  }

  loadServices() {
    this.loading.set(true);
    this.http.get<ApiResponse<ServiceResponseDto[]>>('/api/services').subscribe({
      next: (res) => {
        if (res.success) {
          this.services.set(res.data);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  openModal() {
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveService() {
    this.form.priceQtz = Math.round(this.priceInput * 100);
    this.http.post<ApiResponse<ServiceResponseDto>>('/api/services', this.form).subscribe({
      next: () => {
        this.closeModal();
        this.loadServices();
      }
    });
  }
}
