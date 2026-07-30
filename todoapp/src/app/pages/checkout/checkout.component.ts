import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService, CartItem } from '../../services/cart.service';
import { OrderService, OrderItemPayload } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { isEmptyString, trimString } from '../../utils/validation.util';

interface CustomerInfo {
  email: string;
  fullName: string;
  phone: string;
  city: string;
  address: string;
  paymentMethod: 'nequi' | 'card' | 'transfer';
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent implements OnInit {
  cartItems: CartItem[] = [];
  cartTotal = 0;
  currency: 'COP' | 'USD' = 'USD';
  currentStep: 'review' | 'shipping' | 'payment' | 'confirm' = 'review';
  isProcessing = false;
  readonly freeShippingThresholdCOP = 100000;
  readonly copToUsdRate = 5000;

  customerInfo: CustomerInfo = {
    email: '',
    fullName: '',
    phone: '',
    city: '',
    address: '',
    paymentMethod: 'nequi'
  };

  orderError = '';

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.currency = this.cartService.getCurrency();
      if (this.cartItems.length === 0) {
        this.router.navigate(['/home']);
      }
    });

    this.cartService.cartTotal$.subscribe(total => {
      this.cartTotal = total;
    });
  }

  nextStep() {
    if (this.currentStep === 'review') {
      this.currentStep = 'shipping';
    } else if (this.currentStep === 'shipping') {
      if (this.validateShipping()) {
        this.currentStep = 'payment';
      }
    } else if (this.currentStep === 'payment') {
      this.currentStep = 'confirm';
    }
  }

  previousStep() {
    if (this.currentStep === 'shipping') {
      this.currentStep = 'review';
    } else if (this.currentStep === 'payment') {
      this.currentStep = 'shipping';
    } else if (this.currentStep === 'confirm') {
      this.currentStep = 'payment';
    }
  }

  validateShipping(): boolean {
    const { email, fullName, phone, city, address } = this.customerInfo;
    // Evitar valores que solo contengan espacios
    if (isEmptyString(email) || isEmptyString(fullName) || isEmptyString(phone) || isEmptyString(city) || isEmptyString(address)) {
      this.notificationService.notify('Rellena los campos vacíos y corrige los errores del formulario.', 'error');
      return false;
    }
    if (!this.isValidEmail(email)) {
      this.notificationService.notify('Por favor, ingresa un correo electrónico válido en Email.', 'error');
      return false;
    }
    if (!this.isValidPhone(phone)) {
      this.notificationService.notify('Por favor, ingresa un número de teléfono válido en Teléfono.', 'error');
      return false;
    }
    return true;
  }

  isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  isValidPhone(phone: string): boolean {
    // Acepta números con prefijo internacional y hasta 25 caracteres, permitiendo guiones, espacios y paréntesis
    const regex = /^[\+\d][\d\s\-\(\)]{6,24}$/;
    return regex.test(phone);
  }

  confirmPurchase() {
    if (this.cartItems.length === 0) {
      this.notificationService.notify('Tu carrito está vacío. Agrega productos antes de continuar.', 'info');
      this.router.navigate(['/home']);
      return;
    }

    this.orderError = '';
    this.isProcessing = true;

    const payload = {
      userId: this.authService.getUser()?.userId,
      customerInfo: {
        ...this.customerInfo,
        email: trimString(this.customerInfo.email),
        fullName: trimString(this.customerInfo.fullName),
        phone: trimString(this.customerInfo.phone),
        city: trimString(this.customerInfo.city),
        address: trimString(this.customerInfo.address)
      },
      items: this.cartItems.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        currency: item.currency ?? 'USD'
      } as OrderItemPayload)),
      total: this.cartTotal,
      shippingCost: this.getShippingCost(this.cartTotal, this.currency),
      currency: this.currency
    };

    this.orderService.createOrder(payload).subscribe(order => {
      this.isProcessing = false;
      if (!order) {
        this.orderError = 'Error al procesar el pedido. Intenta nuevamente más tarde.';
        this.notificationService.notify('Error al procesar el pedido. Intenta nuevamente más tarde.', 'error');
        return;
      }

      const sale = this.cartService.checkout();
      if (sale) {
        this.notificationService.notify(`Compra exitosa — Pedido confirmado para ${this.customerInfo.fullName}.`, 'success');
        this.router.navigate(['/home']);
      } else {
        this.orderError = 'La orden se registró en el backend, pero no se pudo actualizar el carrito local. Recarga la página.';
        this.notificationService.notify('La orden se registró en el backend, pero no se pudo actualizar el carrito local. Recarga la página.', 'error');
      }
    });
  }

  goBack() {
    if (this.currentStep === 'review') {
      this.router.navigate(['/home']);
    } else {
      this.previousStep();
    }
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
    return this.isShippingFree(amount, currency) ? 0 : (currency === 'COP' ? 12000 : 2.5);
  }

  getShippingLabel(amount: number, currency: 'COP' | 'USD'): string {
    if (this.isShippingFree(amount, currency)) {
      return 'Gratis';
    }
    const cost = this.getShippingCost(amount, currency);
    return currency === 'COP'
      ? `$${Math.round(cost).toLocaleString('es-CO')} COP`
      : `$${cost.toFixed(2)} USD`;
  }

  getOrderTotal(amount: number, currency: 'COP' | 'USD'): number {
    return amount + this.getShippingCost(amount, currency);
  }

  formatPrice(price: number): string {
    if (this.currency === 'COP') {
      return `$${Math.round(price).toLocaleString('es-CO')} COP`;
    }
    return `$${price.toFixed(2)} USD`;
  }

  getItemSubtotal(item: CartItem): string {
    const subtotal = item.price * item.quantity;
    const itemCurrency = item.currency ?? 'USD';
    if (itemCurrency === 'COP') {
      return `$${Math.round(subtotal).toLocaleString('es-CO')} COP`;
    }
    return `$${subtotal.toFixed(2)} USD`;
  }

  getPaymentMethodLabel(): string {
    const labels: { [key: string]: string } = {
      nequi: '📱 Nequi',
      card: '💳 Tarjeta de Crédito',
      transfer: '🏦 Transferencia Bancaria'
    };
    return labels[this.customerInfo.paymentMethod] || 'Nequi';
  }
}
