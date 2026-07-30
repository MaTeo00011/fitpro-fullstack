import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from './notification.service';
import { ProductService } from './product.service';
import { AuthService, AppUser } from './auth.service';

// Interface para tipar nuestros productos en el carrito
export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  icon: string;
  image?: string;
  currency?: 'COP' | 'USD';
  maxStock: number; // Máximo disponible
}

export interface Sale {
  id: number;
  date: Date;
  items: CartItem[];
  total: number;
  shippingCost?: number;
  currency: 'COP' | 'USD';
}

@Injectable({
  providedIn: 'root' // Hace que el servicio esté disponible en toda la app
})
export class CartService {
  
  // BehaviorSubject = Observable que guarda el último valor
  // Permite que múltiples componentes se "suscriban" a los cambios
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  
  // Observable público que los componentes pueden escuchar
  cartItems$ = this.cartItems.asObservable();
  
  // Total del carrito
  private cartTotal = new BehaviorSubject<number>(0);
  cartTotal$ = this.cartTotal.asObservable();
  
  // Umbrales y costos de envío
  readonly freeShippingThresholdCOP = 100000;
  readonly copToUsdRate = 5000;
  readonly defaultShippingCOP = 12000;
  readonly defaultShippingUSD = 2.5;

  // Estado del sidebar (abierto/cerrado)
  private sidebarOpen = new BehaviorSubject<boolean>(false);
  sidebarOpen$ = this.sidebarOpen.asObservable();

  // Ventas guardadas
  private sales = new BehaviorSubject<Sale[]>([]);
  sales$ = this.sales.asObservable();
  private nextSaleId = 1;

  constructor(
    private productService: ProductService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {
    // Opcional: Cargar carrito y ventas desde localStorage al iniciar
    this.loadCartFromStorage();
    this.loadSalesFromStorage();
    this.syncCartWithProductUpdates();

    this.authService.currentUser$.subscribe(() => {
      this.loadCartFromStorage();
      this.loadSalesFromStorage();
    });
  }

  private syncCartWithProductUpdates() {
    this.productService.products$.subscribe(products => {
      const currentCart = this.cartItems.value;
      let changed = false;

      const updatedCart = currentCart.reduce<CartItem[]>((cart, item) => {
        const product = products.find(p => p.id === item.id);

        // Producto eliminado desde admin
        if (!product) {
          changed = true;
          this.notificationService.notify(
            `El producto ${item.name} ya no está disponible y fue eliminado del carrito.`,
            'info'
          );
          return cart;
        }

        // Producto agotado desde admin
        if (product.stock === 0) {
          changed = true;
          this.notificationService.notify(
            `El producto ${product.name} está agotado y fue eliminado del carrito.`,
            'error'
          );
          return cart;
        }

        let updatedItem: CartItem = {
          ...item,
          price: product.price,
          currency: product.currency,
          maxStock: product.stock,
          name: product.name,
          image: product.image,
          icon: product.icon
        };

        // Si la cantidad actual supera el stock actualizado, se reduce al stock disponible
        if (updatedItem.quantity > product.stock) {
          updatedItem = {
            ...updatedItem,
            quantity: product.stock
          };
          changed = true;
          this.notificationService.notify(
            `La cantidad de ${product.name} se ajustó a ${product.stock} por disponibilidad de stock.`,
            'info'
          );
        }

        if (
          updatedItem.price !== item.price ||
          updatedItem.currency !== item.currency ||
          updatedItem.maxStock !== item.maxStock ||
          updatedItem.name !== item.name ||
          updatedItem.image !== item.image ||
          updatedItem.icon !== item.icon ||
          updatedItem.quantity !== item.quantity
        ) {
          changed = true;
        }

        cart.push(updatedItem);
        return cart;
      }, []);

      if (changed) {
        this.cartItems.next(updatedCart);
        this.calculateTotal();
        this.saveCartToStorage();
      }
    });
  }

  // 🛒 AGREGAR producto al carrito
  addToCart(product: any): boolean {
    const currentCart = this.cartItems.value;
    
    // Verificar si el producto ya existe en el carrito
    const existingItem = currentCart.find(item => item.id === product.id);
    
        if (existingItem) {
      // Si existe, aumentar cantidad (respetando límite)
      if (existingItem.quantity < existingItem.maxStock) {
        existingItem.quantity++;
      } else {
        // Usar NotificationService si está disponible
        try { this.notificationService.notify(`⚠️ Stock máximo alcanzado para ${product.name}`, 'error'); } catch { /* fallback */ }
        return false;
      }
    } else {
      // Si no existe, agregarlo como nuevo item
      const newItem: CartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        icon: product.icon,
        image: product.image,
        currency: product.currency,
        maxStock: product.stock || 10 // Default: 10 unidades
      };
      currentCart.push(newItem);
    }
    
    // Actualizar el carrito y el total
    this.cartItems.next(currentCart);
    this.calculateTotal();
    this.saveCartToStorage();
    
    // Abrir el sidebar automáticamente
    this.openSidebar();
    return true;
  }

  // ➕ AUMENTAR cantidad
  increaseQuantity(productId: number) {
    const currentCart = this.cartItems.value;
    const item = currentCart.find(i => i.id === productId);
    
    if (item && item.quantity < item.maxStock) {
      item.quantity++;
      this.cartItems.next(currentCart);
      this.calculateTotal();
      this.saveCartToStorage();
    }
  }

  // ➖ DISMINUIR cantidad (mínimo 1)
  decreaseQuantity(productId: number) {
    const currentCart = this.cartItems.value;
    const item = currentCart.find(i => i.id === productId);
    
    if (item && item.quantity > 1) {
      item.quantity--;
      this.cartItems.next(currentCart);
      this.calculateTotal();
      this.saveCartToStorage();
    }
  }

  // 🗑️ ELIMINAR producto del carrito
  removeFromCart(productId: number) {
    const currentCart = this.cartItems.value.filter(item => item.id !== productId);
    this.cartItems.next(currentCart);
    this.calculateTotal();
    this.saveCartToStorage();
  }

  // 🧹 VACIAR carrito completo
  clearCart() {
    this.cartItems.next([]);
    this.cartTotal.next(0);
    localStorage.removeItem(this.getCartStorageKey());
  }

  // 💰 CALCULAR total
  private calculateTotal() {
    const total = this.cartItems.value.reduce(
      (sum, item) => sum + (item.price * item.quantity), 
      0
    );
    this.cartTotal.next(total);
  }

  // 📂 ABRIR sidebar
  openSidebar() {
    this.sidebarOpen.next(true);
  }

  // ❌ CERRAR sidebar
  closeSidebar() {
    this.sidebarOpen.next(false);
  }

  private getStorageScope(): string {
    const user = this.authService.getUser();
    return user?.userId ? `user-${user.userId}` : 'guest';
  }

  private getCartStorageKey(): string {
    return `cart-${this.getStorageScope()}`;
  }

  private getSalesStorageKey(): string {
    return `sales-${this.getStorageScope()}`;
  }

  // 💾 GUARDAR en localStorage (persistencia)
  private saveCartToStorage() {
    localStorage.setItem(this.getCartStorageKey(), JSON.stringify(this.cartItems.value));
  }

  // 📥 CARGAR desde localStorage
  private loadCartFromStorage() {
    const savedCart = localStorage.getItem(this.getCartStorageKey());
    if (savedCart) {
      const cart = JSON.parse(savedCart);
      this.cartItems.next(cart);
      this.calculateTotal();
    }
  }

  // 📂 CARGAR ventas desde localStorage
  private loadSalesFromStorage() {
    const savedSales = localStorage.getItem(this.getSalesStorageKey());
    if (savedSales) {
      try {
        const sales: Sale[] = JSON.parse(savedSales).map((s: any) => ({
          ...s,
          date: new Date(s.date)
        }));
        this.sales.next(sales);
        this.nextSaleId = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;
      } catch (error) {
        console.error('Error al cargar ventas:', error);
      }
    }
  }

  // 💾 GUARDAR ventas en localStorage
  private saveSalesToStorage() {
    localStorage.setItem(this.getSalesStorageKey(), JSON.stringify(this.sales.value));
  }

  // ↩️ OBTENER ventas
  getSales(): Sale[] {
    return this.sales.value;
  }

  // 📅 Filtrar ventas de hoy
  getSalesToday(): Sale[] {
    const today = new Date().toDateString();
    return this.sales.value.filter(sale => new Date(sale.date).toDateString() === today);
  }

  // 💳 Crear un registro de venta local después de que el backend haya procesado la orden
  checkout(): Sale | null {
    const currentCart = this.cartItems.value;
    const total = this.cartTotal.value;
    const currency = this.getCurrency();
    const shippingCost = this.getShippingCost(total, currency);
    const finalTotal = total + shippingCost;

    if (currentCart.length === 0) {
      try { this.notificationService.notify('El carrito está vacío. Agrega productos antes de finalizar compra.', 'info'); } catch {}
      return null;
    }

    for (const item of currentCart) {
      const product = this.productService.getProductById(item.id);
      if (!product) {
        try { this.notificationService.notify(`⚠️ El producto ${item.name} ya no está disponible.`, 'error'); } catch {}
        return null;
      }

      if (item.quantity > product.stock) {
        try { this.notificationService.notify(`⚠️ No hay suficiente stock de ${product.name} (disponible: ${product.stock}).`, 'error'); } catch {}
        return null;
      }
    }

    const newSale: Sale = {
      id: this.nextSaleId++,
      date: new Date(),
      items: JSON.parse(JSON.stringify(currentCart)),
      total: finalTotal,
      shippingCost,
      currency
    };

    this.sales.next([...this.sales.value, newSale]);
    this.saveSalesToStorage();

    this.clearCart();
    this.productService.loadProductsFromServer();
    return newSale;
  }

  // 💱 Obtener moneda del carrito (o USD por defecto)
  getCurrency(): 'COP' | 'USD' {
    const firstItem = this.cartItems.value[0];
    return firstItem?.currency ?? 'USD';
  }

  // Formatear precio en string para alertas
  formatPrice(price: number, currency: 'COP' | 'USD'): string {
    if (currency === 'COP') {
      return `$${Math.round(price).toLocaleString('es-CO')} COP`;
    }
    return `$${price.toFixed(2)} USD`;
  }

  getShippingThreshold(currency: 'COP' | 'USD'): number {
    return currency === 'COP'
      ? this.freeShippingThresholdCOP
      : Math.round(this.freeShippingThresholdCOP / this.copToUsdRate);
  }

  isShippingFree(amount: number, currency: 'COP' | 'USD'): boolean {
    return amount >= this.getShippingThreshold(currency);
  }

  getShippingCost(amount: number, currency: 'COP' | 'USD'): number {
    return this.isShippingFree(amount, currency)
      ? 0
      : (currency === 'COP' ? this.defaultShippingCOP : this.defaultShippingUSD);
  }

  getOrderTotal(amount: number, currency: 'COP' | 'USD'): number {
    return amount + this.getShippingCost(amount, currency);
  }

  // 📊 OBTENER cantidad total de items
  getTotalItems(): number {
    return this.cartItems.value.reduce((sum, item) => sum + item.quantity, 0);
  }
}