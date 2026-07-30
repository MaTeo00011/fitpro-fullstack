import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, Subject, tap } from 'rxjs';
import { API_BASE_URL } from '../app.constants';

export interface OrderItemPayload {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  currency: 'COP' | 'USD';
}

export interface CustomerInfoPayload {
  email: string;
  fullName: string;
  phone: string;
  city: string;
  address: string;
  paymentMethod: 'nequi' | 'card' | 'transfer';
}

export interface OrderRequestPayload {
  userId?: number;
  customerInfo: CustomerInfoPayload;
  items: OrderItemPayload[];
  total: number;
  shippingCost: number;
  currency: 'COP' | 'USD';
}

export interface OrderResponse {
  id?: number;
  orderId?: number;
  customerInfo: CustomerInfoPayload;
  items: OrderItemPayload[];
  total: number;
  shippingCost: number;
  currency: 'COP' | 'USD';
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${API_BASE_URL}/api/ventas`;
  // Emite cuando hay una orden nueva creada (para que componentes recarguen)
  private ordersUpdated = new Subject<void>();
  ordersUpdated$ = this.ordersUpdated.asObservable();

  constructor(private http: HttpClient) {}

  createOrder(payload: OrderRequestPayload): Observable<OrderResponse | null> {
    return this.http.post<OrderResponse>(this.apiUrl, payload).pipe(
      map(response => response),
      tap(res => {
        if (res) {
          this.ordersUpdated.next();
        }
      }),
      catchError(error => {
        console.error('Error creando orden:', error);
        return of(null);
      })
    );
  }

  getOrdersByUser(userId: number): Observable<OrderResponse[]> {
  return this.http.get<any[]>(`${this.apiUrl}?userId=${userId}`).pipe(
    map(orders => (orders || []).map(response => ({
      ...response,
      customerInfo: response.customerInfo ?? {
        fullName: response.customerName ?? '',
        email: response.customerEmail ?? '',
        phone: response.phone ?? '',
        city: response.city ?? '',
        address: response.address ?? '',
        paymentMethod: response.paymentMethod ?? 'card'
      }
    })) as OrderResponse[]),
    catchError(error => {
      console.error('Error cargando ordenes del usuario:', error);
      return of([]);
    })
  );
}

  getOrderById(orderId: number): Observable<OrderResponse | null> {
  return this.http.get<any>(`${this.apiUrl}/${orderId}`).pipe(
    map(response => {
      if (!response) return null;
      // Normalizar: el backend devuelve campos en la raíz, no en customerInfo
      return {
        ...response,
        customerInfo: response.customerInfo ?? {
          fullName: response.customerName ?? '',
          email: response.customerEmail ?? '',
          phone: response.phone ?? '',
          city: response.city ?? '',
          address: response.address ?? '',
          paymentMethod: response.paymentMethod ?? 'card'
        }
      } as OrderResponse;
    }),
    catchError(error => {
      console.error('Error cargando detalle de orden:', error);
      return of(null);
    })
  );
}
}
