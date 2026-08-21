import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../core/auth/auth.store';
import { ThemeService, BooklyTheme } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell">
      <aside class="sidebar-glass">
        <div class="logo-box">
          <span class="logo-icon">⚡</span>
          <h2>Bookly</h2>
          <span class="badge-pill">Admin</span>
        </div>

        <nav class="nav-menu">
          <a routerLink="/app/appointments" routerLinkActive="active" class="nav-item">
            <span class="icon">📅</span>
            <span>Agenda de Citas</span>
          </a>
          <a routerLink="/app/services" routerLinkActive="active" class="nav-item">
            <span class="icon">🛎</span>
            <span>Servicios</span>
          </a>
        </nav>

        <div class="user-card-footer">
          <div class="user-info">
            <strong>{{ authStore.user()?.name || 'Administrador' }}</strong>
            <small>{{ authStore.user()?.email || 'admin@tenant.com' }}</small>
          </div>
          <button (click)="logout()" class="btn-logout" title="Cerrar sesión">Salir</button>
        </div>
      </aside>

      <main class="main-body">
        <header class="topbar-glass">
          <div class="tenant-identity">
            🏢 Clínica Dental Morales · Panel Administrativo
          </div>
          <div class="header-right">
            <div class="theme-picker">
              <button (click)="changeTheme('midnight-emerald')" [class.active]="themeService.currentTheme() === 'midnight-emerald'">🌿 Emerald</button>
              <button (click)="changeTheme('obsidian-luxe')" [class.active]="themeService.currentTheme() === 'obsidian-luxe'">💎 Obsidian</button>
              <button (click)="changeTheme('titanium-oled')" [class.active]="themeService.currentTheme() === 'titanium-oled'">⚡ Titanium</button>
            </div>
            <div class="system-status">
              <span class="pulse-dot"></span> Cloudflare D1
            </div>
          </div>
        </header>

        <div class="content-scroll">
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
      background: var(--color-bg);
      background-image: var(--color-bg-gradient);
    }
    .sidebar-glass {
      width: 260px;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-right: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      padding: 1.75rem 1.25rem;
    }
    .logo-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 2.25rem;
      h2 {
        font-size: 1.25rem;
        font-weight: 800;
        color: #ffffff;
      }
      .logo-icon {
        font-size: 1.25rem;
        color: var(--color-primary);
      }
    }
    .badge-pill {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      background: var(--color-primary-light);
      color: var(--color-primary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      text-transform: uppercase;
    }
    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      flex: 1;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      color: var(--color-text-muted);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
      transition: all 0.15s;
      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
      }
      &.active {
        background: var(--color-primary-light);
        color: #ffffff;
        border: 1px solid var(--color-primary);
        box-shadow: var(--shadow-glow);
      }
    }
    .user-card-footer {
      border-top: 1px solid var(--color-border);
      padding-top: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .user-info {
      display: flex;
      flex-direction: column;
      font-size: 0.8125rem;
      strong { color: #ffffff; }
      small { color: var(--color-text-dim); }
    }
    .btn-logout {
      background: none;
      border: none;
      color: var(--color-danger);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
    }
    .main-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .topbar-glass {
      height: 64px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .tenant-identity { color: #ffffff; }
    .header-right {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }
    .theme-picker {
      display: flex;
      gap: 0.25rem;
      background: rgba(0, 0, 0, 0.3);
      padding: 0.2rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      button {
        background: transparent;
        border: none;
        color: var(--color-text-muted);
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.25rem 0.55rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.15s;
        &.active { background: var(--color-primary); color: white; }
      }
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: var(--color-success);
      border-radius: var(--radius-full);
      box-shadow: 0 0 8px var(--color-success);
    }
    .content-scroll {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
  `]
})
export class AdminLayoutComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly themeService = inject(ThemeService);

  changeTheme(theme: BooklyTheme) {
    this.themeService.setTheme(theme);
  }

  logout() {
    this.authStore.logout();
  }
}
