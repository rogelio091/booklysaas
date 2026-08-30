import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs';
import type { CustomerResponseDto } from '@bookly/contracts';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-customers-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-shell">
      <header class="header-flex">
        <div class="header-title">
          <h1>Clientes</h1>
          <p class="subtitle">Busca y consulta la base de clientes del negocio</p>
        </div>
      </header>

      <!-- Barra de búsqueda -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          [formControl]="searchControl"
          placeholder="Buscar por nombre o teléfono..."
          aria-label="Buscar clientes"
        />
        @if (searchTerm()) {
          <button type="button" class="search-clear" (click)="clearSearch()" aria-label="Limpiar búsqueda">✕</button>
        }
      </div>

      @if (loading()) {
        <div class="state-box">Cargando clientes del tenant...</div>
      } @else if (customers().length === 0) {
        <div class="state-box">
          @if (searchTerm()) {
            No se encontraron clientes para "{{ searchTerm() }}".
          } @else {
            No hay clientes registrados todavía.
          }
        </div>
      } @else {
        <div class="table-glass-card">
          <table class="dark-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Fecha de creación</th>
              </tr>
            </thead>
            <tbody>
              @for (customer of customers(); track customer.id) {
                <tr>
                  <td data-label="Nombre"><strong>{{ customer.name }}</strong></td>
                  <td data-label="Teléfono">{{ customer.phone }}</td>
                  <td data-label="Email">{{ customer.email || '—' }}</td>
                  <td data-label="Fecha de creación">{{ customer.createdAt | date:'mediumDate' }}</td>
                </tr>
              }
            </tbody>
          </table>
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

      .search-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 0.55rem 0.9rem;
        transition: border-color 0.15s, box-shadow 0.15s;
        max-width: 480px;
        &:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-glow);
        }
        .search-icon {
          color: var(--color-text-muted);
          font-size: 0.9rem;
        }
        input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-family: inherit;
          font-size: 0.875rem;
          &::placeholder {
            color: var(--color-text-dim);
          }
        }
        .search-clear {
          background: none;
          border: none;
          color: var(--color-text-muted);
          font-size: 0.9rem;
          cursor: pointer;
          padding: 0.1rem 0.25rem;
          &:hover {
            color: #fff;
          }
        }
      }

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
        th,
        td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--color-border);
          text-align: left;
        }
        th {
          background: rgba(0, 0, 0, 0.3);
          font-weight: 700;
          color: var(--color-text-muted);
        }
        td {
          color: var(--color-text);
        }
      }
      .state-box {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-muted);
      }

      /* ===== RESPONSIVE ===== */
      @media (max-width: 767px) {
        .search-bar {
          max-width: 100%;
        }

        /* Tabla → tarjetas */
        .dark-table thead {
          display: none;
        }
        .dark-table tbody,
        .dark-table tr,
        .dark-table td {
          display: block;
          width: 100%;
        }
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
      }
    `,
  ],
})
export class CustomersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly customers = signal<CustomerResponseDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchTerm = signal('');
  protected readonly searchControl = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        tap((term) => this.searchTerm.set(term)),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((term) => this.loadCustomers(term));

    // Carga inicial: primeros 50 clientes (GET sin search).
    this.loadCustomers();
  }

  loadCustomers(search?: string): void {
    this.loading.set(true);
    const term = search?.trim();
    this.api.getCustomers(term || undefined).subscribe({
      next: (res) => {
        if (res.success) {
          this.customers.set(res.data);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }
}
