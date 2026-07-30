
import { API_BASE_URL } from '../app.constants';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';

// Interface para tipar nuestros productos
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: 'COP' | 'USD';
  stock: number;
  icon: string; // Emoji (mantener para compatibilidad)
  image?: string; // ← NUEVO: URL de imagen en base64
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  
  // BehaviorSubject para lista de productos
  private apiUrl = `${API_BASE_URL}/api/productos`;
  private products = new BehaviorSubject<Product[]>([]);
  products$ = this.products.asObservable();

  constructor(private http: HttpClient) {
    this.loadProductsFromServer();
  }

  // 📚 OBTENER todos los productos
  getProducts(): Product[] {
    return this.products.value;
  }

  // 🔍 OBTENER producto por ID
  getProductById(id: number): Product | undefined {
    return this.products.value.find(p => p.id === id);
  }

  private parseProduct(product: any): Product {
    return {
      ...product,
      price: Number(product.price),
      stock: Number(product.stock),
      createdAt: new Date(product.createdAt),
      updatedAt: new Date(product.updatedAt)
    };
  }

  loadProductsFromServer(): void {
    this.http.get<Product[]>(this.apiUrl).pipe(
      map(products => products.map(product => this.parseProduct(product))),
      tap(products => this.products.next(products)),
      catchError(error => {
        console.error('Error cargando productos desde el servidor:', error);
        return of([]);
      })
    ).subscribe();
  }

  // ➕ AGREGAR nuevo producto
  addProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.http.post<Product>(this.apiUrl, productData).pipe(
      map(product => this.parseProduct(product)),
      tap(product => this.products.next([...this.products.value, product])),
      catchError(error => {
        console.error('Error agregando producto:', error);
        return of(null);
      })
    );
  }

  // ✏️ ACTUALIZAR producto existente
  updateProduct(id: number, productData: Partial<Product>) {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, productData).pipe(
      map(product => this.parseProduct(product)),
      tap(product => {
        const updatedProducts = this.products.value.map(item => item.id === product.id ? product : item);
        this.products.next(updatedProducts);
      }),
      catchError(error => {
        console.error('Error actualizando producto:', error);
        return of(null);
      })
    );
  }

  // 🗑️ ELIMINAR producto
  deleteProduct(id: number) {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`).pipe(
      map(() => true),
      tap(() => {
        const updatedProducts = this.products.value.filter(product => product.id !== id);
        this.products.next(updatedProducts);
      }),
      catchError(error => {
        console.error('Error eliminando producto:', error);
        return of(false);
      })
    );
  }

  // 🔄 RESETEAR productos a los valores por defecto
  resetToDefaults(): void {
    this.products.next([]);
    this.loadProductsFromServer();
  }
}