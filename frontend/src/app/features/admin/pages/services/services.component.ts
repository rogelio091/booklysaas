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
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1>Catálogo de Servicios</h1>
          <p class="subtitle">Configura los servicios ofrecidos, duración y precios</p>
        </div>
        <button (click)="openModal()" class="btn-primary">+ Nuevo Servicio</button>
      </header>

      @if (loading()) {
        <div class="state-msg">Cargando servicios...</div>
      } @else {
        <div class="services-grid">
          @for (service of services(); track service.id) {
            <div class="service-card">
              <div class="card-header">
                <h3>{{ service.name }}</h3>
                <span class="price-tag">Q{{ (service.priceQtz / 100).toFixed(2) }}</span>
              </div>
              <p class="desc">{{ service.description || 'Sin descripción' }}</p>
              <div class="card-footer">
                <span class="meta">⏱ {{ service.durationMinutes }} min (+{{ service.bufferAfterMinutes }} min buffer)</span>
                <span class="status" [class.active]="service.isActive">
                  {{ service.isActive ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
            </div>
          } @empty {
            <div class="empty-state">No hay servicios configurados aún. ¡Crea el primero!</div>
          }
        </div>
      }

      @if (showModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <h2>Nuevo Servicio</h2>
            <form (ngSubmit)="saveService()" class="service-form">
              <label>
                Nombre del servicio
                <input [(ngModel)]="form.name" name="name" required placeholder="Ej. Limpieza Dental" />
              </label>

              <label>
                Descripción
                <textarea [(ngModel)]="form.description" name="description" rows="2"></textarea>
              </label>

              <div class="form-row">
                <label>
                  Duración (minutos)
                  <input type="number" [(ngModel)]="form.durationMinutes" name="duration" required min="5" />
                </label>
                <label>
                  Buffer posterior (min)
                  <input type="number" [(ngModel)]="form.bufferAfterMinutes" name="buffer" min="0" />
                </label>
              </div>

              <label>
                Precio (Quetzales)
                <input type="number" [(ngModel)]="priceInput" name="price" required min="0" step="0.5" />
              </label>

              <div class="modal-actions">
                <button type="button" (click)="closeModal()" class="btn-cancel">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .btn-primary {
      background: var(--color-primary);
      color: white;
      border: none;
      padding: 0.6rem 1.2rem;
      border-radius: var(--radius-md);
      font-weight: 500;
      cursor: pointer;
    }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .service-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      h3 { font-size: 1.125rem; }
      .price-tag { font-weight: 700; color: var(--color-primary); }
    }
    .desc { color: var(--color-text-muted); font-size: 0.875rem; flex: 1; }
    .card-footer {
      border-top: 1px solid var(--color-border);
      padding-top: 0.75rem;
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
    }
    .status {
      font-weight: 600;
      color: var(--color-danger);
      &.active { color: var(--color-success); }
    }
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-card {
      background: var(--color-surface);
      padding: 2rem;
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 480px;
    }
    .service-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1.5rem;
      label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.875rem;
        font-weight: 500;
      }
      input, textarea {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        font-family: inherit;
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
      background: none;
      border: 1px solid var(--color-border);
      padding: 0.6rem 1rem;
      border-radius: var(--radius-md);
      cursor: pointer;
    }
    .state-msg, .empty-state { text-align: center; padding: 3rem; color: var(--color-text-muted); }
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
