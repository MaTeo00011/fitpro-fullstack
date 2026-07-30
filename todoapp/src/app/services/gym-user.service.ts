import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';

// Interface para usuarios del gimnasio
export interface GymUser {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  phone: string;  // Para WhatsApp
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

import { API_BASE_URL } from '../app.constants';

@Injectable({
  providedIn: 'root'
})
export class GymUserService {

  // BehaviorSubject para lista de usuarios
  private apiUrl = `${API_BASE_URL}/api/usuarios`;

  private users = new BehaviorSubject<GymUser[]>([]);
  users$ = this.users.asObservable();

  constructor(private http: HttpClient) {
    this.loadUsersFromServer();
  }

  // 📚 OBTENER todos los usuarios
  getUsers(): GymUser[] {
    return this.users.value;
  }

  // 🔍 OBTENER usuario por ID
  getUserById(id: number): GymUser | undefined {
    return this.users.value.find(u => u.id === id);
  }

  private parseGymUser(user: any): GymUser {
  const paymentEnd = new Date(user.paymentEnd);
  return {
    ...user,
    paymentStart: new Date(user.paymentStart),
    paymentEnd,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    personalizedDetails: user.personalizedType ? { type: user.personalizedType } : undefined,
    status: this.calculateStatus(paymentEnd) // ← recalcula siempre al cargar
  };
}

  private mapGymUserPayload(userData: any) {
    return {
      ...userData,
      personalizedType: userData.personalizedDetails?.type ?? null
    };
  }

  loadUsersFromServer(): void {
    this.http.get<GymUser[]>(this.apiUrl).pipe(
      map(users => users.map(user => this.parseGymUser(user))),
      tap(users => this.users.next(users)),
      catchError(error => {
        console.error('Error cargando usuarios desde el servidor:', error);
        return of([]);
      })
    ).subscribe();
  }

  // ➕ AGREGAR nuevo usuario
  addUser(userData: Omit<GymUser, 'id' | 'createdAt' | 'updatedAt' | 'paymentEnd' | 'status'>) {
    return this.http.post<GymUser>(this.apiUrl, this.mapGymUserPayload(userData)).pipe(
      map(user => this.parseGymUser(user)),
      tap(user => this.users.next([...this.users.value, user])),
      catchError(error => {
        console.error('Error agregando usuario:', error);
        return of(null);
      })
    );
  }

  // ✏️ ACTUALIZAR usuario
  updateUser(id: number, updates: Partial<GymUser>) {
    return this.http.put<GymUser>(`${this.apiUrl}/${id}`, this.mapGymUserPayload(updates)).pipe(
      map(user => this.parseGymUser(user)),
      tap(user => {
        const updatedUsers = this.users.value.map(item => item.id === user.id ? user : item);
        this.users.next(updatedUsers);
      }),
      catchError(error => {
        console.error('Error actualizando usuario:', error);
        return of(null);
      })
    );
  }

  // 🗑️ ELIMINAR usuario
  deleteUser(id: number) {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`).pipe(
      map(() => true),
      tap(() => {
        const updatedUsers = this.users.value.filter(user => user.id !== id);
        this.users.next(updatedUsers);
      }),
      catchError(error => {
        console.error('Error eliminando usuario:', error);
        return of(false);
      })
    );
  }

  // 🔄 ACTUALIZAR estados de todos los usuarios (llamar periódicamente)
  updateAllStatuses(): void {
    const users = this.users.value.map(user => ({
      ...user,
      status: this.calculateStatus(user.paymentEnd)
    }));
    this.users.next(users);
  }

  // 📊 Calcular estado basado en fecha
  private calculateStatus(endDate: Date): 'active' | 'expiring' | 'expired' {
    const now = new Date();
    const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'expiring';
    return 'active';
  }

  // 🔄 RESETEAR usuarios a la lista del servidor
  resetToDefaults(): void {
    this.loadUsersFromServer();
  }
}
