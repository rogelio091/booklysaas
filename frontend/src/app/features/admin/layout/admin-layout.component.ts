import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="logo">
          <h2>Bookly</h2>
          <span class="badge">Admin</span>
        </div>

        <nav class="nav-links">
          <a routerLink="/app/appointments" routerLinkActive="active" class="nav-item">
            <span class="icon">📅</span>
            <span>Agenda</span>
          </a>
          <a routerLink="/app/services" routerLinkActive="active" class="nav-item">
            <span class="icon">🛎</span>
            <span>Servicios</span>
          </a>
        </nav>

        <div class="user-footer">
          <div class="user-info">
            <strong>{{ authStore.user()?.name || 'Administrador' }}</strong>
            <small>{{ authStore.user()?.email }}</small>
          </div>
          <button (click)="logout()" class="btn-logout" title="Cerrar sesión">Salir</button>
        </div>
      </aside>

      <main class="main-content">
        <header class="top-bar">
          <div class="company-badge">
            🏢 Panel de Gestión Multi-Tenant
          </div>
        </header>

        <div class="content-body">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .admin-shell {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background: var(--color-background);
    }
    .sidebar {
      width: 260px;
      background: var(--color-surface);
      border-right: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      padding: 1.5rem 1rem;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
      h2 {
        font-size: 1.25rem;
        color: var(--color-primary);
      }
    }
    .badge {
      font-size: 0.75rem;
      padding: 0.15rem 0.4rem;
      background: #e0e7ff;
      color: #3730a3;
      border-radius: var(--radius-sm);
    }
    .nav-links {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      color: var(--color-text);
      text-decoration: none;
      font-weight: 500;
      transition: background 0.15s;
      &:hover {
        background: #f1f5f9;
      }
      &.active {
        background: #eff6ff;
        color: var(--color-primary);
      }
    }
    .user-footer {
      border-top: 1px solid var(--color-border);
      padding-top: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .user-info {
      display: flex;
      flex-direction: column;
      font-size: 0.8125rem;
      small {
        color: var(--color-text-muted);
      }
    }
    .btn-logout {
      background: none;
      border: none;
      color: var(--color-danger);
      font-size: 0.8125rem;
      cursor: pointer;
    }
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .top-bar {
      height: 60px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      padding: 0 2rem;
      font-size: 0.9375rem;
      font-weight: 500;
    }
    .content-body {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
  `]
})
export class AdminLayoutComponent {
  protected readonly authStore = inject(AuthStore);

  logout() {
    this.authStore.logout();
  }
}
