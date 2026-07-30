import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, switchMap } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_BASE_URL } from '../app.constants';

export type UserRole = 'admin' | 'user';

export interface AppUser {
  username: string;
  role: UserRole;
  userId?: number;
  status?: 'active' | 'expiring' | 'expired' | string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthResponse {
  token?: string;
  role: UserRole;
  username: string;
  userId?: number;
  status?: string;
}

interface AuthMeResponse {
  user: AppUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = `${API_BASE_URL}/api/auth`;
  private currentUser = new BehaviorSubject<AppUser | null>(null);
  currentUser$ = this.currentUser.asObservable();
  private tokenKey = 'app-auth-token';
  private userKey = 'app-current-user';

  constructor(private http: HttpClient) {
    this.initializeSession();
  }

  private initializeSession(): void {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return;
    }

    this.http.get<AuthMeResponse>(`${this.authUrl}/me`, { headers: this.getAuthHeaders(token) }).pipe(
      map(response => response.user),
      catchError(() => {
        this.clearSession();
        return of(null);
      })
    ).subscribe(user => {
      if (user) {
        this.currentUser.next(user);
        localStorage.setItem(this.userKey, JSON.stringify(user));
      }
    });
  }

  private saveSession(user: AppUser, token: string): void {
    this.currentUser.next(user);
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  private clearSession(): void {
    this.currentUser.next(null);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  private getAuthHeaders(token?: string): HttpHeaders {
    const authToken = token || localStorage.getItem(this.tokenKey);
    return new HttpHeaders({
      Authorization: `Bearer ${authToken}`
    });
  }

  loginAdmin(username: string, password: string): Observable<AuthResult> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return of({ success: false, error: 'Por favor ingresa el usuario administrador.' });
    }

    return this.http.post<AuthResponse>(`${this.authUrl}/login`, { username: trimmedUsername, password }).pipe(
      map(response => {
        if (response.role === 'admin' && response.token) {
          const user: AppUser = { username: response.username, role: 'admin' };
          this.saveSession(user, response.token);
          return { success: true };
        }
        return { success: false, error: 'No se pudo iniciar sesión como administrador' };
      }),
      catchError((error: any) => {
        console.error('Error en login admin:', error);
        const errorMessage = error?.error?.error || 'Error al iniciar sesión como administrador';
        return of({ success: false, error: errorMessage });
      })
    );
  }

  logout(): void {
    this.clearSession();
  }

  isAdmin(): boolean {
    const user = this.currentUser.value;
    return !!user && user.role === 'admin';
  }

  isUser(): boolean {
    const user = this.currentUser.value;
    return !!user && user.role === 'user';
  }

  isLoggedIn(): boolean {
    return !!this.currentUser.value;
  }

  loginUser(username: string): Observable<AuthResult> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return of({ success: false, error: 'Por favor ingresa tu nombre completo' });
    }

    return this.http.post<AuthResponse>(`${this.authUrl}/login`, { username: trimmedUsername, password: '' }).pipe(
      map(response => {
        if (response.role === 'user' && response.token) {
          const user: AppUser = {
            username: response.username,
            role: 'user',
            userId: response.userId,
            status: response.status
          };
          this.saveSession(user, response.token);
          return { success: true };
        }
        return { success: false, error: 'No se pudo iniciar sesión como usuario' };
      }),
      catchError((error: any) => {
        console.error('Error en login usuario:', error);
        const errorMessage = error?.error?.error || 'Error al iniciar sesión como usuario';
        return of({ success: false, error: errorMessage });
      })
    );
  }

  getUser(): AppUser | null {
    return this.currentUser.value;
  }
}
