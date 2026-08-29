import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { LoginRequestDto } from '@bookly/contracts';
import { ApiService } from '../../../core/services/api.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { BrandLogoComponent } from '../../../core/brand/brand-logo.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, BrandLogoComponent],
  template: `
    <div class="login-shell">
      <div class="login-card">
        <div class="brand">
          <app-brand-logo class="brand-mark" />
          <h1>Bookly</h1>
          <p class="tagline">Panel administrativo</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="tu@email.com"
              autocomplete="email"
            />
            @if (emailCtrl.invalid && emailCtrl.touched) {
              <span class="field-error">Ingresá un email válido</span>
            }
          </div>

          <div class="field">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="••••••••"
              autocomplete="current-password"
            />
            @if (passwordCtrl.invalid && passwordCtrl.touched) {
              <span class="field-error">La contraseña debe tener al menos 6 caracteres</span>
            }
          </div>

          @if (errorMessage()) {
            <div class="alert-error">{{ errorMessage() }}</div>
          }

          <button type="submit" class="btn-login" [disabled]="form.invalid || isSubmitting()">
            @if (isSubmitting()) {
              <span class="spinner"></span>
            }
            Entrar
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-shell {
      min-height: 100vh;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background: var(--color-bg);
      background-image: var(--color-bg-gradient);
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      background: var(--color-surface-glass);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
      padding: 2.5rem 2rem;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }

    .brand {
      text-align: center;
      margin-bottom: 2rem;
    }
    .brand-mark {
      display: inline-block;
      margin-bottom: 0.5rem;
      filter: drop-shadow(0 0 18px var(--color-primary-glow));
    }
    .brand h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0.5rem 0 0.25rem;
    }
    .tagline {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1.25rem;
    }
    .field label {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--color-text-muted);
    }
    .field input {
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: rgba(255, 255, 255, 0.03);
      color: var(--color-text);
      font-size: 0.95rem;
      transition: border-color 0.15s, box-shadow 0.15s;

      &:focus {
        outline: none;
        border-color: var(--color-border-focus);
        box-shadow: 0 0 0 3px var(--color-primary-light);
      }
      &.ng-invalid.ng-touched {
        border-color: var(--color-danger);
      }
    }

    .field-error {
      color: var(--color-danger);
      font-size: 0.75rem;
    }

    .alert-error {
      background: var(--color-danger-bg);
      color: var(--color-danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.9rem;
      font-size: 0.8125rem;
      margin-bottom: 1.25rem;
    }

    .btn-login {
      width: 100%;
      padding: 0.8rem 1rem;
      border: none;
      border-radius: var(--radius-md);
      background: var(--color-primary);
      color: #06110e;
      font-weight: 800;
      font-size: 0.95rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.15s, box-shadow 0.15s;

      &:hover:not(:disabled) {
        background: var(--color-primary-hover);
        box-shadow: var(--shadow-glow);
      }
      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(6, 17, 14, 0.3);
      border-top-color: #06110e;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 479px) {
      .login-card { padding: 2rem 1.25rem; }
    }
  `],
})
export class LoginComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  get emailCtrl() {
    return this.form.controls.email;
  }
  get passwordCtrl() {
    return this.form.controls.password;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const credentials: LoginRequestDto = this.form.getRawValue();

    this.api.login(credentials).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.success) {
          this.authStore.setAuth(res.data);
          this.router.navigate(['/app/appointments']);
        } else {
          this.errorMessage.set('Credenciales inválidas');
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Credenciales inválidas');
      },
    });
  }
}
