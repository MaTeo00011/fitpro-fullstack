import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../services/cart.service';
import { NotificationService } from '../../services/notification.service';
import { ProductService, Product } from '../../services/product.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-detail.component.html',
  styles: [
    `
      .product-detail-page {
        max-width: 960px;
        margin: 0 auto;
        padding: 2rem;
      }
      .breadcrumbs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
        color: #666;
      }
      .breadcrumbs a {
        color: #1e40af;
        text-decoration: none;
      }
      .detail-card {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        background: white;
        border-radius: 24px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
        padding: 2rem;
      }
      .detail-image {
        border-radius: 24px;
        width: 100%;
        height: auto;
        object-fit: cover;
      }
      .detail-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .detail-title {
        font-size: 2rem;
        margin: 0;
      }
      .detail-meta {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .meta-pill {
        padding: 0.5rem 1rem;
        border-radius: 999px;
        background: #eef2ff;
        color: #1e3a8a;
        font-weight: 700;
      }
      .detail-buttons {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin-top: 1rem;
      }
      .button-primary,
      .button-secondary {
        border: none;
        border-radius: 999px;
        padding: 0.95rem 1.6rem;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .button-primary {
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: white;
      }
      .button-secondary {
        background: #f3f4f6;
        color: #111827;
      }
      .button-primary:hover,
      .button-secondary:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 30px rgba(37, 99, 235, 0.18);
      }
      .detail-description {
        line-height: 1.8;
        color: #334155;
      }
      .detail-note {
        background: #eff6ff;
        padding: 1rem;
        border-radius: 18px;
        color: #1e3a8a;
        margin-top: 1rem;
      }
      .detail-legend {
        margin-top: 1rem;
        display: flex;
        gap: 0.75rem;
        font-size: 0.95rem;
        color: #475569;
      }
      @media (max-width: 900px) {
        .detail-card {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class ProductDetailComponent implements OnInit {
  product: Product | null = null;
  productId: number | null = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.error = 'ID de producto inválido.';
      this.loading = false;
      return;
    }

    this.productId = id;
    this.productService.products$.subscribe(products => {
      const product = products.find(item => item.id === id);
      if (product) {
        this.product = product;
        this.loading = false;
      } else if (!this.product && products.length > 0) {
        this.error = 'Producto no encontrado.';
        this.loading = false;
      }
    });
  }

  addToCart() {
    if (!this.product) {
      return;
    }
    const added = this.cartService.addToCart(this.product);
    if (added) {
      this.notificationService.notify(`Añadido al carrito: ${this.product.name}`, 'success');
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  goToCart() {
    this.router.navigate(['/checkout']);
  }

  formatPrice(price: number, currency: 'COP' | 'USD'): string {
    return currency === 'COP'
      ? `$${Math.round(price).toLocaleString('es-CO')} COP`
      : `$${price.toFixed(2)} USD`;
  }
}
