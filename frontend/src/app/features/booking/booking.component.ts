import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { PublicCompanyDto, PublicServiceDto } from '@bookly/contracts';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="booking-container">
      @if (loading()) {
        <div class="loading">Cargando información del portal...</div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (company()) {
        <header class="booking-header">
          <h1>{{ company()?.name }}</h1>
          <p class="subtitle">Selecciona un servicio para agendar tu cita</p>
        </header>

        <section class="services-list">
          @for (service of services(); track service.id) {
            <div class="service-card">
              <div class="service-info">
                <h3>{{ service.name }}</h3>
                <p>{{ service.durationMinutes }} min</p>
              </div>
              <div class="service-price">
                <span>Q{{ (service.priceQtz / 100).toFixed(2) }}</span>
              </div>
            </div>
          } @empty {
            <p>No hay servicios disponibles en este momento.</p>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .booking-container {
      max-width: 600px;
      margin: 2rem auto;
      padding: 1.5rem;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
    }
    .booking-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .subtitle {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
    .services-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .service-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: border-color 0.2s;
      &:hover {
        border-color: var(--color-primary);
      }
    }
    .service-price {
      font-weight: 600;
      color: var(--color-primary);
    }
    .loading, .error {
      text-align: center;
      padding: 2rem;
    }
    .error {
      color: var(--color-danger);
    }
  `]
})
export class BookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  protected readonly company = signal<PublicCompanyDto | null>(null);
  protected readonly services = signal<PublicServiceDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error.set('Slug de empresa no especificado');
      this.loading.set(false);
      return;
    }

    this.loadData(slug);
  }

  private loadData(slug: string) {
    this.api.getCompany(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.company.set(res.data);
          this.loadServices(slug);
        } else {
          this.error.set(res.error?.message || 'Error cargando empresa');
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.error.set(err.message || 'Error de conexión');
        this.loading.set(false);
      }
    });
  }

  private loadServices(slug: string) {
    this.api.getServices(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.services.set(res.data);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }
}
