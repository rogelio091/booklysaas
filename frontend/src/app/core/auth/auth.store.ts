import { Injectable, signal, computed } from '@angular/core';
import type { AuthResponseDto } from '@bookly/contracts';

interface UserState {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'superadmin';
  companyId: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  private readonly tokenSignal = signal<string | null>(this.getStoredToken());
  private readonly userSignal = signal<UserState | null>(this.getStoredUser());

  readonly token = computed(() => this.tokenSignal());
  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => !!this.tokenSignal());

  setAuth(data: AuthResponseDto) {
    this.tokenSignal.set(data.token);
    this.userSignal.set(data.user);
    localStorage.setItem('bookly_token', data.token);
    localStorage.setItem('bookly_user', JSON.stringify(data.user));
  }

  logout() {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    localStorage.removeItem('bookly_token');
    localStorage.removeItem('bookly_user');
  }

  private getStoredToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('bookly_token');
  }

  private getStoredUser(): UserState | null {
    if (typeof localStorage === 'undefined') return null;
    const item = localStorage.getItem('bookly_user');
    return item ? JSON.parse(item) : null;
  }
}
