import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';
import { API_BASE_URL } from '../app.constants';

// Interface para usuarios del gimnasio
export interface GymUser {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  phone: string;
  trainingType: 'general' | 'personalized';
  personalizedDetails?: {
    type: 'fuerza' | 'bajar_peso' | 'definicion' | 'resistencia' | 'tonificacion';
  };
  paymentType: 'dia' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'ano';
  paymentStart: Date;
  paymentEnd: Date;
  status: 'active' | 'expiring' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class GymUserService {
  private apiUrl = `${API_BASE_URL}/api/usuarios`;

  private users = new BehaviorSubject<GymUser[]>([]);
  users$ = this.users.asObservable();

  constructor(private http: HttpClient) {
    this.loadUsersFromServer();
  }

  getUsers(): GymUser[] {
    return this.users.value;
  }

  getUserById(id: number): GymUser | undefined {
    return this.users.value.find(u => u.id === id);
  }

  private parseUser(user: any): GymUser {
    return {
      ...user,
      paymentStart: new Date(user.paymentStart),
      paymentEnd: new Date(user.paymentEnd),
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt)
    };
  }

  loadUsersFromServer(): void {
    this.http.get<GymUser[]>(this.apiUrl).pipe(
      map(users => users.map(user => this.parseUser(user))),
      tap(users => this.users.next(users)),
      catchError(error => {
        console.error('Error cargando usuarios desde el servidor:', error);
        return of([]);
      })
    ).subscribe();
  }

  addUser(userData: Omit<GymUser, 'id' | 'createdAt' | 'updatedAt' | 'paymentEnd' | 'status'>) {
    return this.http.post<GymUser>(this.apiUrl, userData).pipe(
      map(user => this.parseUser(user)),
      tap(user => this.users.next([...this.users.value, user])),
      catchError(error => {
        console.error('Error agregando usuario:', error);
        return of(null);
      })
    );
  }

  updateUser(id: number, updates: Partial<GymUser>) {
    return this.http.put<GymUser>(`${this.apiUrl}/${id}`, updates).pipe(
      map(user => this.parseUser(user)),
      tap(updatedUser => {
        const users = this.users.value.map(user => user.id === updatedUser.id ? updatedUser : user);
        this.users.next(users);
      }),
      catchError(error => {
        console.error('Error actualizando usuario:', error);
        return of(null);
      })
    );
  }

  deleteUser(id: number) {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`).pipe(
      map(() => true),
      tap(() => {
        this.users.next(this.users.value.filter(user => user.id !== id));
      }),
      catchError(error => {
        console.error('Error eliminando usuario:', error);
        return of(false);
      })
    );
  }

  updateAllStatuses(): void {
    const users = this.users.value.map(user => ({
      ...user,
      status: this.calculateStatus(user.paymentEnd)
    }));
    this.users.next(users);
  }

  private calculateStatus(endDate: Date): 'active' | 'expiring' | 'expired' {
    const now = new Date();
    const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'expiring';
    return 'active';
  }
}
