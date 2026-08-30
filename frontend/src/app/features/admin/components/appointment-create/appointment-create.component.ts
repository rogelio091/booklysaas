import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, finalize, EMPTY } from 'rxjs';
import type {
  CreateAdminAppointmentDto,
  CustomerResponseDto,
  ServiceResponseDto,
  StaffResponseDto,
} from '@bookly/contracts';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-appointment-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div class="dark-modal-backdrop" (click)="onBackdropClick($event)">
        <div class="dark-modal-card" role="dialog" aria-modal="true" aria-label="Nueva cita">
          <div class="modal-head">
            <h2>Nueva Cita</h2>
            <button type="button" class="btn-close" (click)="close()" aria-label="Cerrar">✕</button>
          </div>

          @if (loadingOptions()) {
            <div class="state-box">Cargando opciones...</div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="appointment-form">
              <div class="form-group">
                <label for="customerSearch">Buscar cliente existente</label>
                <div class="autocomplete">
                  <input
                    id="customerSearch"
                    type="text"
                    formControlName="customerSearch"
                    placeholder="Buscar por nombre o teléfono..."
                    autocomplete="off"
                  />
                  @if (searchingCustomers()) {
                    <span class="autocomplete-hint">Buscando...</span>
                  }
                  @if (showSuggestions()) {
                    <ul class="suggestion-list">
                      @for (c of customerSuggestions(); track c.id) {
                        <li>
                          <button type="button" (click)="selectCustomer(c)">
                            <strong>{{ c.name }}</strong>
                            <small>{{ c.phone }}</small>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </div>
                <small class="form-hint">Selecciona para autocompletar, o escribe uno nuevo abajo.</small>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="customerName">Nombre del cliente *</label>
                  <input
                    id="customerName"
                    type="text"
                    formControlName="customerName"
                    placeholder="Ej. María Pérez"
                  />
                  @if (showError('customerName')) {
                    <span class="field-error">Campo requerido</span>
                  }
                </div>
                <div class="form-group">
                  <label for="customerPhone">Teléfono *</label>
                  <input
                    id="customerPhone"
                    type="tel"
                    formControlName="customerPhone"
                    placeholder="Ej. +502 5555 5555"
                  />
                  @if (showError('customerPhone')) {
                    <span class="field-error">Campo requerido</span>
                  }
                </div>
              </div>

              <div class="form-group">
                <label for="customerEmail">Email</label>
                <input
                  id="customerEmail"
                  type="email"
                  formControlName="customerEmail"
                  placeholder="cliente@correo.com"
                />
                @if (showError('customerEmail')) {
                  <span class="field-error">Email inválido</span>
                }
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="serviceId">Servicio *</label>
                  <select id="serviceId" formControlName="serviceId">
                    <option [ngValue]="null" disabled>-- Seleccionar servicio --</option>
                    @for (s of services(); track s.id) {
                      <option [ngValue]="s.id">{{ s.name }}</option>
                    }
                  </select>
                  @if (showError('serviceId')) {
                    <span class="field-error">Campo requerido</span>
                  }
                </div>
                <div class="form-group">
                  <label for="staffId">Especialista</label>
                  <select id="staffId" formControlName="staffId">
                    <option [ngValue]="null">Cualquiera disponible</option>
                    @for (st of staff(); track st.id) {
                      <option [ngValue]="st.id">{{ st.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="startAt">Fecha y hora *</label>
                <input id="startAt" type="datetime-local" formControlName="startAt" />
                @if (showError('startAt')) {
                  <span class="field-error">Campo requerido</span>
                }
              </div>

              <div class="form-group">
                <label for="notes">Notas</label>
                <textarea
                  id="notes"
                  formControlName="notes"
                  rows="3"
                  placeholder="Detalles adicionales de la cita..."
                ></textarea>
              </div>

              @if (submitError()) {
                <div class="submit-error">{{ submitError() }}</div>
              }

              <div class="modal-actions">
                <button type="button" (click)="close()" class="btn-cancel">Cancelar</button>
                <button
                  type="submit"
                  class="btn-primary-glow"
                  [disabled]="form.invalid || saving()"
                >
                  {{ saving() ? 'Guardando...' : 'Guardar Cita' }}
                </button>
              </div>
            </form>
          }
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
      .appointment-form {
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
        select,
        textarea {
          padding: 0.75rem 0.9rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: white;
          font-family: inherit;
          font-size: 0.875rem;
          outline: none;
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
      .autocomplete {
        position: relative;
      }
      .autocomplete-hint {
        position: absolute;
        right: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.7rem;
        color: var(--color-text-muted);
        pointer-events: none;
      }
      .suggestion-list {
        position: absolute;
        top: calc(100% + 0.3rem);
        left: 0;
        right: 0;
        background: var(--color-surface);
        border: 1px solid var(--color-border-highlight);
        border-radius: var(--radius-sm);
        max-height: 220px;
        overflow-y: auto;
        z-index: 10;
        box-shadow: var(--shadow-card);
        list-style: none;
        margin: 0;
        padding: 0.25rem;
        button {
          width: 100%;
          text-align: left;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          border: none;
          color: var(--color-text);
          padding: 0.5rem 0.6rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-family: inherit;
          &:hover {
            background: rgba(255, 255, 255, 0.05);
          }
          strong {
            font-size: 0.85rem;
            color: #fff;
          }
          small {
            font-size: 0.75rem;
            color: var(--color-text-muted);
          }
        }
      }
      .form-hint {
        font-size: 0.7rem;
        color: var(--color-text-dim);
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
        &:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
        }
        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
      .state-box {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-muted);
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
export class AppointmentCreateComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly services = signal<ServiceResponseDto[]>([]);
  protected readonly staff = signal<StaffResponseDto[]>([]);
  protected readonly loadingOptions = signal(true);
  protected readonly saving = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly customerSuggestions = signal<CustomerResponseDto[]>([]);
  protected readonly showSuggestions = signal(false);
  protected readonly searchingCustomers = signal(false);

  protected readonly form = new FormGroup({
    customerSearch: new FormControl('', { nonNullable: true }),
    customerName: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    customerPhone: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    customerEmail: new FormControl('', {
      nonNullable: true,
      validators: Validators.email,
    }),
    serviceId: new FormControl<number | null>(null, {
      validators: Validators.required,
    }),
    staffId: new FormControl<number | null>(null),
    startAt: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    notes: new FormControl('', { nonNullable: true }),
  });

  private _open = false;

  @Input() set open(value: boolean) {
    this._open = value;
    if (value) {
      this.reset();
    }
  }
  get open(): boolean {
    return this._open;
  }

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  ngOnInit() {
    this.loadOptions();

    this.form.controls.customerSearch.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          const t = term.trim();
          if (!t) {
            this.customerSuggestions.set([]);
            this.showSuggestions.set(false);
            this.searchingCustomers.set(false);
            return EMPTY;
          }
          this.searchingCustomers.set(true);
          return this.api.getCustomers(t, 10).pipe(
            finalize(() => this.searchingCustomers.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.success) {
          this.customerSuggestions.set(res.data);
          this.showSuggestions.set(res.data.length > 0);
        } else {
          this.customerSuggestions.set([]);
          this.showSuggestions.set(false);
        }
      });
  }

  loadOptions() {
    this.loadingOptions.set(true);
    this.api.getAdminServices().subscribe({
      next: (res) => {
        if (res.success) {
          this.services.set(res.data);
        }
        this.loadingOptions.set(false);
      },
      error: () => {
        this.submitError.set('No se pudieron cargar los servicios');
        this.loadingOptions.set(false);
      },
    });
    this.api.getAdminStaff().subscribe({
      next: (res) => {
        if (res.success) {
          this.staff.set(res.data);
        }
      },
      error: () => {
        // Staff es opcional: no bloquear el formulario si falla.
      },
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateAdminAppointmentDto = {
      customerName: raw.customerName.trim(),
      customerPhone: raw.customerPhone.trim(),
      customerEmail: raw.customerEmail.trim() || null,
      serviceId: raw.serviceId as number,
      staffId: raw.staffId,
      startAt: new Date(raw.startAt).getTime(),
      notes: raw.notes.trim() || null,
    };

    this.saving.set(true);
    this.submitError.set(null);
    this.api.createAppointment(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.created.emit();
        this.close();
      },
      error: () => {
        this.saving.set(false);
        this.submitError.set('No se pudo crear la cita. Inténtalo de nuevo.');
      },
    });
  }

  close() {
    this.closed.emit();
  }

  selectCustomer(customer: CustomerResponseDto) {
    this.form.patchValue({
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email ?? '',
    });
    this.form.controls.customerSearch.setValue('');
    this.customerSuggestions.set([]);
    this.showSuggestions.set(false);
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  showError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  private reset() {
    this.submitError.set(null);
    this.customerSuggestions.set([]);
    this.showSuggestions.set(false);
    this.searchingCustomers.set(false);
    this.form.reset();
  }
}
