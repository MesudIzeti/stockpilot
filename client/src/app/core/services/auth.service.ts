import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUserFromStorage());
  currentUser$ = this.currentUserSubject.asObservable();

  private loadUserFromStorage(): User | null {
    const stored = localStorage.getItem('stockpilot_user');
    return stored ? JSON.parse(stored) : null;
  }

  getToken(): string | null {
    return localStorage.getItem('stockpilot_token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string) {
    return this.http
      .post<{ token: string; user: User }>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap(res => this.saveSession(res.token, res.user)));
  }

  register(name: string, email: string, password: string) {
    return this.http.post<{ message: string; email: string }>(
      `${environment.apiUrl}/auth/register`,
      { name, email, password }
    );
  }

  verifyEmail(email: string, code: string) {
    return this.http
      .post<{ token: string; user: User }>(`${environment.apiUrl}/auth/verify-email`, { email, code })
      .pipe(tap(res => this.saveSession(res.token, res.user)));
  }

  isOwner(): boolean {
    return this.getCurrentUser()?.role !== 'employee';
  }

  isEmployee(): boolean {
    return this.getCurrentUser()?.role === 'employee';
  }

  logout() {
    localStorage.removeItem('stockpilot_token');
    localStorage.removeItem('stockpilot_user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private saveSession(token: string, user: User) {
    localStorage.setItem('stockpilot_token', token);
    localStorage.setItem('stockpilot_user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }
}
