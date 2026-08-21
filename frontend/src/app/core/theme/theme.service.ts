import { Injectable, signal } from '@angular/core';

export type BooklyTheme = 'midnight-emerald' | 'obsidian-luxe' | 'titanium-oled';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly currentTheme = signal<BooklyTheme>('midnight-emerald');

  constructor() {
    const savedTheme = this.getSavedTheme();
    if (savedTheme) {
      this.applyTheme(savedTheme, false);
    } else {
      this.applyTheme('midnight-emerald', false);
    }
  }

  setTheme(theme: BooklyTheme) {
    this.applyTheme(theme, true);
  }

  initFromCompany(companyTheme?: string) {
    // Si el usuario no tiene preferencia manual guardada en este dispositivo, hereda el de la empresa
    const hasManualOverride = typeof localStorage !== 'undefined' && localStorage.getItem('bookly_user_theme');
    if (!hasManualOverride && companyTheme) {
      this.applyTheme(companyTheme as BooklyTheme, false);
    }
  }

  private applyTheme(theme: BooklyTheme, save: boolean) {
    this.currentTheme.set(theme);

    if (typeof document !== 'undefined') {
      document.body.classList.remove('theme-emerald', 'theme-obsidian', 'theme-titanium');
      if (theme === 'midnight-emerald') document.body.classList.add('theme-emerald');
      if (theme === 'obsidian-luxe') document.body.classList.add('theme-obsidian');
      if (theme === 'titanium-oled') document.body.classList.add('theme-titanium');
    }

    if (save && typeof localStorage !== 'undefined') {
      localStorage.setItem('bookly_user_theme', theme);
    }
  }

  private getSavedTheme(): BooklyTheme | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('bookly_user_theme') as BooklyTheme | null;
  }
}
