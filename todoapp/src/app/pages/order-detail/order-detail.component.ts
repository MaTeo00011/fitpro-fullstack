import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OrderService, OrderResponse } from '../../services/order.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './order-detail.component.html',
  styles: [
    `
      .order-detail {
        max-width: 900px;
        margin: 0 auto;
        padding: 24px;
      }
      .order-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }
      .order-info {
        border: 1px solid #ddd;
        border-radius: 12px;
        padding: 18px;
        background: #fff;
      }
      .order-items {
        margin-top: 16px;
      }
      .order-product {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
      }
      .order-product:last-child {
        border-bottom: none;
      }
      .back-button {
        display: inline-block;
        margin-top: 20px;
        padding: 10px 16px;
        background: #233e8b;
        color: white;
        border-radius: 8px;
        text-decoration: none;
      }
      .error-message {
        padding: 32px;
        text-align: center;
      }
    `
  ]
})
export class OrderDetailComponent implements OnInit {
  order: OrderResponse | null = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService
  ) {}

  ngOnInit() {
    const orderId = Number(this.route.snapshot.paramMap.get('id'));
    if (!orderId || Number.isNaN(orderId)) {
      this.error = 'ID de orden inválido.';
      this.loading = false;
      return;
    }

    this.orderService.getOrderById(orderId).subscribe(order => {
      this.loading = false;
      if (!order) {
        this.error = 'No se encontró la orden solicitada.';
        return;
      }
      this.order = order;
    });
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  formatSalePrice(amount: number, currency: 'COP' | 'USD'): string {
    return currency === 'COP'
      ? `$${Math.round(amount).toLocaleString('es-CO')} COP`
      : `$${amount.toFixed(2)} USD`;
  }
}
