import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cart-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-sidebar.component.html',
  styleUrl: './cart-sidebar.component.css'
})
export class CartSidebarComponent implements OnInit, OnDestroy {
  
  // Variables para almacenar los datos del carrito
  cartItems: CartItem[] = [];
  cartTotal: number = 0;
  isOpen: boolean = false;
  
  // Subscripciones (para limpiarlas después)
  private subscriptions: Subscription = new Subscription();

  // Inyectamos el servicio del carrito
  constructor(public cartService: CartService, private router: Router) {}

  // Se ejecuta cuando el componente se carga
  ngOnInit() {
    // Nos suscribimos a los items del carrito
    this.subscriptions.add(
      this.cartService.cartItems$.subscribe(items => {
        this.cartItems = items;
      })
    );

    // Nos suscribimos al total
    this.subscriptions.add(
      this.cartService.cartTotal$.subscribe(total => {
        this.cartTotal = total;
      })
    );

    // Nos suscribimos al estado del sidebar (abierto/cerrado)
    this.subscriptions.add(
      this.cartService.sidebarOpen$.subscribe(isOpen => {
        this.isOpen = isOpen;
      })
    );
  }

  // Se ejecuta cuando el componente se destruye
  ngOnDestroy() {
    // Limpiamos las subscripciones para evitar memory leaks
    this.subscriptions.unsubscribe();
  }

  // Métodos que conectan con el servicio
  closeSidebar() {
    this.cartService.closeSidebar();
  }

  increaseQuantity(productId: number) {
    this.cartService.increaseQuantity(productId);
  }

  decreaseQuantity(productId: number) {
    this.cartService.decreaseQuantity(productId);
  }

  removeItem(productId: number) {
    this.cartService.removeFromCart(productId);
  }

  clearCart() {
    if (confirm('¿Estás seguro de vaciar el carrito?')) {
      this.cartService.clearCart();
    }
  }

  // Método para proceder al checkout y navegar a la página de pago
  checkout() {
    this.cartService.closeSidebar();
    this.router.navigate(['/checkout']);
  }

  // Método para formatear precios correctamente
formatPrice(price: number, currency?: string): string {
  // Si es pesos colombianos (COP)
  if (currency === 'COP') {
    return `$${Math.round(price).toLocaleString('es-CO')}`;
  }
  // Si es dólares o no especifica
  return `$${price.toFixed(2)}`;
}

  // Calcular subtotal formateado
  getItemSubtotal(item: CartItem): string {
    const subtotal = item.price * item.quantity;
    // Usar la moneda del producto si está disponible
    return this.formatPrice(subtotal, (item as any).currency);
  }

  // Detectar qué moneda está usando el carrito
  getCurrency(): string {
    if (this.cartItems.length > 0) {
      return (this.cartItems[0] as any).currency || 'USD';
    }
    return 'USD';
  }
}