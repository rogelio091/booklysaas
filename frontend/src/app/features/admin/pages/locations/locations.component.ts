import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import type {
  LocationResponseDto,
  CreateLocationDto,
  StaffResponseDto,
} from '@bookly/contracts';
import { ApiService } from '../../../../core/services/api.service';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Component({
  selector: 'app-locations-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-shell">
      <header class="header-flex">
        <div>
          <h1>Ubicaciones</h1>
          <p class="subtitle">Gestiona tus puntos de atención, fijos o móviles</p>
        </div>
        <button type="button" (click)="openModal()" class="btn-primary-glow">
          + Nueva Ubicación
        </button>
      </header>

      @if (loadError()) {
        <div class="banner-error">{{ loadError() }}</div>
      }

      @if (loading()) {
        <div class="state-box">Cargando ubicaciones...</div>
      } @else {
        <div class="locations-grid">
          @for (loc of locations(); track loc.id) {
            <div class="location-card">
              <div class="card-head">
                <h3>{{ loc.name }}</h3>
                <span class="type-badge" [class.mobile]="loc.type === 'mobile'">
                  {{ typeLabel(loc.type) }}
                </span>
              </div>

              @if (loc.address) {
                <p class="address-text">📍 {{ loc.address }}</p>
              } @else {
                <p class="address-text dim">Sin dirección registrada</p>
              }

              @if (loc.type === 'mobile' && loc.serviceRadiusKm !== null) {
                <span class="meta-tag">📏 Radio: {{ loc.serviceRadiusKm }} km</span>
              }

              <div class="card-foot">
                <span class="slug-tag">{{ loc.slug }}</span>
                <span class="status-indicator" [class.active]="loc.isActive">
                  {{ loc.isActive ? '● Activo' : '○ Inactivo' }}
                </span>
              </div>

              <div class="card-actions">
                <button type="button" (click)="editLocation(loc)" class="btn-edit">Editar</button>
                <button type="button" (click)="openStaffModal(loc)" class="btn-edit">Staff</button>
                <!-- TODO(L4): asignación de servicios por ubicación: no existe endpoint backend aún. -->
                <button type="button" class="btn-edit disabled" title="Próximamente" disabled>
                  Servicios
                </button>
                <button type="button" (click)="deleteLocation(loc)" class="btn-delete">Eliminar</button>
              </div>
            </div>
          } @empty {
            <div class="empty-state">No hay ubicaciones configuradas aún. ¡Crea la primera!</div>
          }
        </div>
      }

      <!-- Modal crear/editar ubicación -->
      @if (showModal()) {
        <div class="dark-modal-backdrop" (click)="onBackdropClick($event)">
          <div class="dark-modal-card" role="dialog" aria-modal="true" aria-label="Ubicación">
            <div class="modal-head">
              <h2>{{ editingLocation() ? 'Editar Ubicación' : 'Nueva Ubicación' }}</h2>
              <button type="button" class="btn-close" (click)="closeModal()" aria-label="Cerrar">✕</button>
            </div>

            <form [formGroup]="form" (ngSubmit)="saveLocation()" class="location-form">
              <div class="form-group">
                <label for="locName">Nombre *</label>
                <input
                  id="locName"
                  type="text"
                  formControlName="name"
                  placeholder="Ej. Sede Central"
                />
                @if (showError('name')) {
                  <span class="field-error">El nombre es requerido (mín. 2 caracteres)</span>
                }
              </div>

              <div class="form-group">
                <label for="locType">Tipo *</label>
                <select id="locType" formControlName="type">
                  <option value="fixed">Fijo</option>
                  <option value="mobile">Móvil</option>
                </select>
              </div>

              <div class="form-group">
                <label for="locAddress">Dirección</label>
                <input
                  id="locAddress"
                  type="text"
                  formControlName="address"
                  placeholder="Ej. Av. Reforma 4-50, Zona 9"
                />
              </div>

              <div class="form-group">
                <label for="locSlug">Slug *</label>
                <input
                  id="locSlug"
                  type="text"
                  formControlName="slug"
                  placeholder="sede-central"
                />
                @if (showError('slug')) {
                  <span class="field-error">Solo minúsculas, números y guiones</span>
                }
              </div>

              @if (locationType() === 'mobile') {
                <div class="form-group">
                  <label for="locRadius">Radio de servicio (km)</label>
                  <input
                    id="locRadius"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    step="1"
                    formControlName="serviceRadiusKm"
                    placeholder="Ej. 10"
                  />
                </div>
              }

              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" formControlName="isActive" />
                  <span>Ubicación activa</span>
                </label>
              </div>

              @if (submitError()) {
                <div class="submit-error">{{ submitError() }}</div>
              }

              <div class="modal-actions">
                <button type="button" (click)="closeModal()" class="btn-cancel">Cancelar</button>
                <button
                  type="submit"
                  class="btn-primary-glow"
                  [disabled]="form.invalid || saving()"
                >
                  {{ saving() ? 'Guardando...' : (editingLocation() ? 'Guardar Cambios' : 'Crear Ubicación') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal asignación de staff -->
      @if (showStaffModal()) {
        <div class="dark-modal-backdrop" (click)="onStaffBackdropClick($event)">
          <div class="dark-modal-card" role="dialog" aria-modal="true" aria-label="Asignar staff">
            <div class="modal-head">
              <h2>Asignar Staff — {{ staffTarget()?.name }}</h2>
              <button type="button" class="btn-close" (click)="closeStaffModal()" aria-label="Cerrar">✕</button>
            </div>

            @if (staffError()) {
              <div class="submit-error">{{ staffError() }}</div>
            }

            @if (staffLoading()) {
              <div class="state-box">Cargando personal...</div>
            } @else if (allStaff().length === 0) {
              <div class="state-box">No hay personal disponible.</div>
            } @else {
              <ul class="staff-list">
                @for (member of allStaff(); track member.id) {
                  <li>
                    <label class="staff-row">
                      <input
                        type="checkbox"
                        [checked]="selectedIds().includes(member.id)"
                        (change)="toggleStaff(member.id)"
                      />
                      <span class="staff-name">{{ member.name }}</span>
                      <small class="staff-email">{{ member.email }}</small>
                    </label>
                  </li>
                }
              </ul>
            }

            <div class="modal-actions">
              <button type="button" (click)="closeStaffModal()" class="btn-cancel">Cancelar</button>
              <button
                type="button"
                (click)="saveStaff()"
                class="btn-primary-glow"
                [disabled]="staffLoading() || staffSaving()"
              >
                {{ staffSaving() ? 'Guardando...' : 'Guardar Asignación' }}
              </button>
            </div>
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
        h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #fff;
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
        &:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
        }
        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
      .banner-error {
        background: var(--color-danger-bg);
        color: var(--color-danger);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: var(--radius-sm);
        padding: 0.7rem 0.9rem;
        font-size: 0.85rem;
      }
      .locations-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.25rem;
      }
      .location-card {
        background: var(--color-surface-glass);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 1.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        box-shadow: var(--shadow-card);
        transition: all 0.2s;
        &:hover {
          border-color: var(--color-border-highlight);
          transform: translateY(-2px);
        }
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.5rem;
        h3 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }
        .type-badge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
          background: var(--color-primary-light);
          color: var(--color-primary);
          border: 1px solid var(--color-border);
          white-space: nowrap;
          &.mobile {
            background: rgba(168, 85, 247, 0.15);
            color: #c084fc;
          }
        }
      }
      .address-text {
        color: var(--color-text-muted);
        font-size: 0.825rem;
        margin: 0;
        line-height: 1.4;
        &.dim {
          color: var(--color-text-dim);
        }
      }
      .meta-tag {
        color: var(--color-text-dim);
        font-size: 0.75rem;
      }
      .card-foot {
        border-top: 1px solid var(--color-border);
        padding-top: 0.85rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
      }
      .slug-tag {
        color: var(--color-text-dim);
        font-family: monospace;
        font-size: 0.72rem;
      }
      .status-indicator {
        font-weight: 700;
        color: var(--color-danger);
        &.active {
          color: var(--color-success);
        }
      }
      .card-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .btn-edit,
      .btn-delete {
        background: transparent;
        border: 1px solid var(--color-primary);
        color: var(--color-primary);
        padding: 0.45rem 0.9rem;
        border-radius: var(--radius-md);
        font-weight: 700;
        font-size: 0.78rem;
        cursor: pointer;
        transition: all 0.15s;
        &:hover:not(:disabled) {
          background: var(--color-primary-glow);
          border-color: var(--color-primary);
        }
        &.disabled,
        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }
      .btn-delete {
        border-color: var(--color-danger);
        color: var(--color-danger);
        &:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
          border-color: var(--color-danger);
        }
      }

      /* ===== MODALES ===== */
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
      .location-form {
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
      .checkbox-group {
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          color: var(--color-text);
          font-weight: 600;
          input {
            width: 1rem;
            height: 1rem;
            accent-color: var(--color-primary);
          }
        }
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
      .staff-list {
        list-style: none;
        margin: 0 0 1rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        max-height: 320px;
        overflow-y: auto;
      }
      .staff-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        background: rgba(0, 0, 0, 0.2);
        input {
          accent-color: var(--color-primary);
          width: 1rem;
          height: 1rem;
        }
        .staff-name {
          font-size: 0.875rem;
          color: #fff;
          font-weight: 600;
        }
        .staff-email {
          margin-left: auto;
          font-size: 0.72rem;
          color: var(--color-text-muted);
        }
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
      .state-box,
      .empty-state {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-muted);
      }

      /* ===== RESPONSIVE ===== */
      @media (max-width: 767px) {
        .header-flex {
          flex-direction: column;
          align-items: stretch;
          gap: 0.75rem;
        }
        .header-flex .btn-primary-glow {
          align-self: flex-start;
        }
        .locations-grid {
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
export class LocationsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly locations = signal<LocationResponseDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly showModal = signal(false);
  protected readonly editingLocation = signal<LocationResponseDto | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly locationType = signal<'fixed' | 'mobile'>('fixed');

  protected readonly showStaffModal = signal(false);
  protected readonly staffTarget = signal<LocationResponseDto | null>(null);
  protected readonly allStaff = signal<StaffResponseDto[]>([]);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly staffLoading = signal(false);
  protected readonly staffSaving = signal(false);
  protected readonly staffError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    type: new FormControl<'fixed' | 'mobile'>('fixed', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    address: new FormControl('', { nonNullable: true }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(SLUG_PATTERN)],
    }),
    serviceRadiusKm: new FormControl<number | null>(null, {
      validators: [Validators.min(0)],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  ngOnInit() {
    this.loadLocations();

    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((t) => this.locationType.set(t));
  }

  typeLabel(type: LocationResponseDto['type']): string {
    return type === 'mobile' ? 'Móvil' : 'Fijo';
  }

  loadLocations() {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getLocations().subscribe({
      next: (res) => {
        if (res.success) {
          this.locations.set(res.data);
        } else {
          this.loadError.set(res.error?.message ?? 'No se pudieron cargar las ubicaciones.');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(this.backendErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  openModal() {
    this.editingLocation.set(null);
    this.submitError.set(null);
    this.form.reset({
      name: '',
      type: 'fixed',
      address: '',
      slug: '',
      serviceRadiusKm: null,
      isActive: true,
    });
    this.locationType.set('fixed');
    this.showModal.set(true);
  }

  editLocation(loc: LocationResponseDto) {
    this.editingLocation.set(loc);
    this.submitError.set(null);
    this.form.reset({
      name: loc.name,
      type: loc.type,
      address: loc.address ?? '',
      slug: loc.slug,
      serviceRadiusKm: loc.serviceRadiusKm ?? null,
      isActive: loc.isActive,
    });
    this.locationType.set(loc.type);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingLocation.set(null);
  }

  saveLocation() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const editing = this.editingLocation();
    this.saving.set(true);
    this.submitError.set(null);

    const request$ = editing
      ? this.api.updateLocation(editing.id, payload)
      : this.api.createLocation(payload);

    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.closeModal();
          this.loadLocations();
        } else {
          this.submitError.set(res.error?.message ?? 'No se pudo guardar la ubicación.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.submitError.set(this.backendErrorMessage(err));
      },
    });
  }

  deleteLocation(loc: LocationResponseDto) {
    if (!confirm(`¿Eliminar la ubicación "${loc.name}"?`)) {
      return;
    }
    this.loadError.set(null);
    this.api.deleteLocation(loc.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.loadLocations();
        } else {
          this.loadError.set(res.error?.message ?? 'No se pudo eliminar la ubicación.');
        }
      },
      error: (err) => {
        this.loadError.set(this.backendErrorMessage(err));
      },
    });
  }

  openStaffModal(loc: LocationResponseDto) {
    this.staffTarget.set(loc);
    this.showStaffModal.set(true);
    this.staffError.set(null);
    this.staffLoading.set(true);
    this.selectedIds.set([]);
    this.allStaff.set([]);

    let pending = 2;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) {
        this.staffLoading.set(false);
      }
    };

    this.api
      .getAdminStaff()
      .pipe(finalize(finish))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.allStaff.set(res.data.filter((s) => s.isActive));
          }
        },
        error: () => this.staffError.set('No se pudo cargar el personal.'),
      });

    this.api
      .getLocationStaff(loc.id)
      .pipe(finalize(finish))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.selectedIds.set(res.data.map((s) => s.id));
          }
        },
        error: () => this.staffError.set('No se pudo cargar el personal asignado.'),
      });
  }

  closeStaffModal() {
    this.showStaffModal.set(false);
    this.staffTarget.set(null);
    this.staffError.set(null);
  }

  toggleStaff(id: number) {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  saveStaff() {
    const loc = this.staffTarget();
    if (!loc) {
      return;
    }
    this.staffSaving.set(true);
    this.staffError.set(null);
    this.api.assignLocationStaff(loc.id, this.selectedIds()).subscribe({
      next: (res) => {
        this.staffSaving.set(false);
        if (res.success) {
          this.closeStaffModal();
        } else {
          this.staffError.set(res.error?.message ?? 'No se pudo guardar la asignación.');
        }
      },
      error: (err) => {
        this.staffSaving.set(false);
        this.staffError.set(this.backendErrorMessage(err));
      },
    });
  }

  showError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  onStaffBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeStaffModal();
    }
  }

  private buildPayload(): CreateLocationDto {
    const raw = this.form.getRawValue();
    return {
      name: raw.name.trim(),
      address: raw.address.trim() ? raw.address.trim() : null,
      slug: raw.slug.trim().toLowerCase(),
      type: raw.type,
      serviceRadiusKm: raw.type === 'mobile' ? (raw.serviceRadiusKm ?? null) : null,
      isActive: raw.isActive,
    };
  }

  private backendErrorMessage(err: unknown): string {
    const e = err as { error?: { error?: { message?: string } } };
    return e?.error?.error?.message ?? 'No se pudo completar la operación.';
  }
}
