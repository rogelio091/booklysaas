import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../core/auth/auth.store';
import { ThemeService, BooklyTheme } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell" [class.sidebar-collapsed]="collapsed()">
      <!-- Overlay del drawer en móvil -->
      <div class="drawer-overlay" [class.open]="drawerOpen()" (click)="drawerOpen.set(false)"></div>

      <!-- Sidebar: permanente en desktop, drawer deslizante en móvil -->
      <aside class="sidebar-glass" [class.open]="drawerOpen()">
        <div class="logo-box">
          <span class="logo-icon">⚡</span>
          <h2>Bookly</h2>
          <span class="badge-pill">Admin</span>
          <button
            class="collapse-toggle"
            (click)="toggleSidebar()"
            [attr.aria-label]="collapsed() ? 'Expandir' : 'Colapsar'"
          >
            {{ collapsed() ? '›' : '‹' }}
          </button>
          <button class="drawer-close" (click)="drawerOpen.set(false)" aria-label="Cerrar menú">
            ✕
          </button>
        </div>

        <nav class="nav-menu">
          <a
            routerLink="/app/appointments"
            routerLinkActive="active"
            class="nav-item"
            (click)="drawerOpen.set(false)"
          >
            <span class="icon">📅</span>
            <span>Agenda de Citas</span>
          </a>
          <a
            routerLink="/app/services"
            routerLinkActive="active"
            class="nav-item"
            (click)="drawerOpen.set(false)"
          >
            <span class="icon">🛎</span>
            <span>Servicios</span>
          </a>
          <a
            routerLink="/app/calendar"
            routerLinkActive="active"
            class="nav-item"
            (click)="drawerOpen.set(false)"
          >
            <span class="icon">🗓</span>
            <span>Calendario</span>
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
          <div class="topbar-left">
            <!-- Botón hamburguesa (solo móvil/tablet) -->
            <button class="hamburger" (click)="drawerOpen.set(true)" aria-label="Abrir menú">
              ☰
            </button>
            <div class="tenant-identity">🏢 Panel Administrativo</div>
          </div>
          <div class="header-right">
            <div class="theme-picker">
              <button
                (click)="changeTheme('midnight-emerald')"
                [class.active]="themeService.currentTheme() === 'midnight-emerald'"
                title="Midnight Emerald"
              >
                🌿
              </button>
              <button
                (click)="changeTheme('obsidian-luxe')"
                [class.active]="themeService.currentTheme() === 'obsidian-luxe'"
                title="Obsidian Luxe"
              >
                💎
              </button>
              <button
                (click)="changeTheme('titanium-oled')"
                [class.active]="themeService.currentTheme() === 'titanium-oled'"
                title="Titanium OLED"
              >
                ⚡
              </button>
            </div>
            <div class="system-status">
              <span class="pulse-dot"></span>
              <span class="status-text">D1</span>
            </div>
          </div>
        </header>

        <div class="content-scroll">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .admin-shell {
        display: flex;
        height: 100vh;
        width: 100vw;
        overflow: hidden;
        background: var(--color-bg);
        background-image: var(--color-bg-gradient);
      }

      /* ===== SIDEBAR (desktop: fijo · móvil: drawer) ===== */
      .sidebar-glass {
        width: 260px;
        flex-shrink: 0;
        transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-right: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
        padding: 1.75rem 1.25rem;
        z-index: 110;
      }

      .sidebar-collapsed .sidebar-glass {
        width: 72px;
        padding: 1.75rem 0.5rem;
      }
      .sidebar-collapsed .sidebar-glass .nav-item {
        justify-content: center;
        padding: 0.75rem 0;
      }
      .sidebar-collapsed .sidebar-glass .nav-item span:not(.icon) {
        display: none;
      }
      .sidebar-collapsed .sidebar-glass .logo-box h2,
      .sidebar-collapsed .sidebar-glass .badge-pill,
      .sidebar-collapsed .sidebar-glass .user-info,
      .sidebar-collapsed .sidebar-glass .btn-logout {
        display: none;
      }
      .sidebar-collapsed .sidebar-glass .logo-box {
        justify-content: center;
      }
      .sidebar-collapsed .sidebar-glass .user-card-footer {
        justify-content: center;
      }
      .collapse-toggle {
        display: none;
        margin-left: auto;
        background: none;
        border: none;
        color: var(--color-text-muted);
        font-size: 1.1rem;
        cursor: pointer;
        @media (min-width: 1024px) {
          display: block;
        }
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

      /* Botón cerrar drawer: visible solo en móvil */
      .drawer-close {
        display: none;
        margin-left: auto;
        background: none;
        border: none;
        color: var(--color-text-muted);
        font-size: 1.1rem;
        cursor: pointer;
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
        strong {
          color: #ffffff;
        }
        small {
          color: var(--color-text-dim);
        }
      }
      .btn-logout {
        background: none;
        border: none;
        color: var(--color-danger);
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
      }

      /* ===== CONTENIDO PRINCIPAL ===== */
      .main-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-width: 0;
      }

      .topbar-glass {
        height: 64px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 1.25rem;
        font-size: 0.9rem;
        font-weight: 600;
        gap: 0.75rem;
      }

      .topbar-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
      }

      .tenant-identity {
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .hamburger {
        display: none;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--color-border);
        color: var(--color-text);
        font-size: 1.2rem;
        line-height: 1;
        padding: 0.4rem 0.7rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-shrink: 0;
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
          font-size: 0.8rem;
          padding: 0.25rem 0.45rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
          opacity: 0.55;
          transition: all 0.15s;
          &:hover {
            opacity: 0.9;
          }
          &.active {
            opacity: 1;
            background: var(--color-primary);
            border-radius: var(--radius-sm);
          }
        }
      }

      .pulse-dot {
        width: 8px;
        height: 8px;
        background: var(--color-success);
        border-radius: var(--radius-full);
        box-shadow: 0 0 8px var(--color-success);
      }
      .status-text {
        font-size: 0.72rem;
        color: var(--color-text-muted);
      }

      .content-scroll {
        flex: 1;
        padding: 1.5rem;
        overflow-y: auto;
      }

      /* Overlay del drawer (solo móvil) */
      .drawer-overlay {
        display: none;
      }

      /* ===== RESPONSIVE: MÓVIL Y TABLET ===== */
      @media (max-width: 1023px) {
        .hamburger {
          display: block;
        }
        .status-text {
          display: none;
        } // solo el punto verde en móvil

        .sidebar-glass {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          transform: translateX(-100%);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: var(--shadow-card);
          &.open {
            transform: translateX(0);
          }
        }

        .drawer-close {
          display: block;
        }

        .drawer-overlay {
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(2px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s;
          z-index: 100;
          &.open {
            opacity: 1;
            pointer-events: auto;
          }
        }
      }

      @media (max-width: 767px) {
        .content-scroll {
          padding: 1rem;
        }
        .topbar-glass {
          padding: 0 0.9rem;
        }
        .tenant-identity {
          font-size: 0.85rem;
        }
      }

      @media (max-width: 479px) {
        .tenant-identity {
          display: none;
        } // solo hamburguesa en pantallas muy chicas
      }
    `,
  ],
})
export class AdminLayoutComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly themeService = inject(ThemeService);
  protected readonly drawerOpen = signal(false);
  protected readonly collapsed = signal(false);
  private readonly router = inject(Router);

  changeTheme(theme: BooklyTheme) {
    this.themeService.setTheme(theme);
  }

  toggleSidebar() {
    this.collapsed.update((c) => !c);
  }

  logout() {
    this.authStore.logout();
    this.router.navigate(['/app/login']);
  }
}
