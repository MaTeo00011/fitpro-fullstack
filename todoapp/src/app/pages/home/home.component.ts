import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { NotificationService } from '../../services/notification.service';
import { ProductService, Product } from '../../services/product.service';
import { AuthService, AppUser } from '../../services/auth.service';
import { OrderService, OrderResponse } from '../../services/order.service';

// Interface para las slides del carrusel
interface CarouselSlide {
  image: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  
  products: Product[] = [];
  filteredProducts: Product[] = [];
  currentUser: AppUser | null = null;
  
  // Búsqueda y filtros
  searchTerm: string = '';
  selectedCategory: string = '';
  selectedCurrency: '' | 'COP' | 'USD' = '';
  selectedStock: 'all' | 'in' | 'out' = 'all';
  priceFilter: Record<'COP' | 'USD', { min: number; max: number }> = {
    COP: { min: 0, max: 0 },
    USD: { min: 0, max: 0 }
  };
  maxPriceByCurrency: Record<'COP' | 'USD', number> = {
    COP: 0,
    USD: 0
  };
  showFilters: boolean = false;
  categories: string[] = [];
  currencyOptions: ('COP' | 'USD')[] = ['COP', 'USD'];

  get sales$() {
    return this.cartService.sales$;
  }

  serverSales: OrderResponse[] = [];

  formatSalePrice(amount: number, currency: 'COP' | 'USD'): string {
    return currency === 'COP'
      ? `$${Math.round(amount).toLocaleString('es-CO')} COP`
      : `$${amount.toFixed(2)} USD`;
  }
  
  // CARRUSEL
  slides: CarouselSlide[] = [
    {
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200',
      title: '💪 Transforma Tu Cuerpo',
      subtitle: 'Los mejores suplementos para alcanzar tus objetivos'
    },
    {
      image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200',
      title: '⚡ Energía Sin Límites',
      subtitle: 'Pre-workouts que te llevarán al siguiente nivel'
    },
    {
      image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200',
      title: '🎯 Resultados Reales',
      subtitle: 'Calidad profesional, precios accesibles'
    },
    {
      image: 'https://images.unsplash.com/photo-1606902965551-dce093cda6e7?w=1200',  // Imagen de tarro de proteína
      title: '🏆 La Mejor Proteína',
      subtitle: '25g de proteína pura en cada porción'
    },
    {
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200',  // Nueva slide con imagen de proteína
      title: '🥛 Proteína de Alta Calidad',
      subtitle: 'Nutre tus músculos con lo mejor de la naturaleza'
    }
  ];
  
  currentSlide = 0;
  autoPlayInterval: any;
  
  isAdmin = false;

  constructor(
    public cartService: CartService,
    private notificationService: NotificationService,
    private productService: ProductService,
    private authService: AuthService,
    private orderService: OrderService,
    private router: Router
  ) {}

  logoutAdmin() {
    this.authService.logout();
    this.isAdmin = false;
    this.notificationService.notify('Sesión de administrador cerrada.', 'info');
    this.router.navigate(['/']);
  }

  logoutUser() {
    this.authService.logout();
    this.currentUser = null;
    this.notificationService.notify('Sesión cerrada. ¡Hasta pronto!', 'info');
    this.router.navigate(['/']);
  }

  ngOnInit() {
    // Cargar productos
    this.productService.products$.subscribe(products => {
      this.products = products;
      this.updatePriceFilters();
      this.loadCategories();
      this.applyFilters();
    });

    // Verificar usuario actual
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isAdmin = user?.role === 'admin';
      if (user?.userId) {
        this.loadUserOrders(user.userId);
      } else {
        this.serverSales = [];
      }
      this.handleUserStatusAlert(user);
    });

    // Recargar pedidos cuando se cree una nueva orden en cualquier parte de la app
    this.orderService.ordersUpdated$.subscribe(() => {
      if (this.currentUser?.userId) {
        this.loadUserOrders(this.currentUser.userId);
      }
    });

    // Iniciar auto-play del carrusel
    this.startAutoPlay();
  }
  
  ngOnDestroy() {
    // Limpiar interval al destruir el componente
    this.stopAutoPlay();
  }

  private loadUserOrders(userId: number) {
    this.orderService.getOrdersByUser(userId).subscribe(orders => {
      this.serverSales = orders;
    });
  }

  private handleUserStatusAlert(user: AppUser | null) {
    if (!user || !user.status || user.role !== 'user') {
      return;
    }

    if (user.status === 'expiring') {
      this.notificationService.notify(
        'Tu membresía está por expirar. Renueva pronto para seguir disfrutando del servicio.',
        'info'
      );
    } else if (user.status === 'expired') {
      this.notificationService.notify(
        'Tu membresía ha expirado. Renueva ahora para recuperar acceso completo.',
        'error'
      );
    }
  }

  // ===== MÉTODOS DEL CARRUSEL =====
  
  // Iniciar reproducción automática
  startAutoPlay() {
    this.autoPlayInterval = setInterval(() => {
      this.nextSlide();
    }, 5000); // Cambia cada 5 segundos
  }
  
  // Detener reproducción automática
  stopAutoPlay() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
    }
  }
  
  // Siguiente slide
  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }
  
  // Slide anterior
  prevSlide() {
    this.currentSlide = this.currentSlide === 0 
      ? this.slides.length - 1 
      : this.currentSlide - 1;
  }
  
  // Ir a slide específico
  goToSlide(index: number) {
    this.currentSlide = index;
  }
  
  // Pausar al pasar el mouse
  onMouseEnter() {
    this.stopAutoPlay();
  }
  
  // Reanudar al quitar el mouse
  onMouseLeave() {
    this.startAutoPlay();
  }

  // ===== MÉTODOS EXISTENTES =====
  
  addToCart(product: Product) {
    const added = this.cartService.addToCart(product);
    if (added) {
      this.notificationService.notify(`Añadido al carrito: ${product.name}`, 'success');
    }
  }

  scrollToProducts() {
    const element = document.getElementById('productos');
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  openCart() {
    this.cartService.openSidebar();
  }

  // ===== MÉTODOS DE BÚSQUEDA Y FILTROS =====

  loadCategories() {
    // Extraer categorías únicas de los productos
    const uniqueCategories = Array.from(
      new Set(this.products.map(p => p.category).filter(Boolean))
    ) as string[];
    this.categories = uniqueCategories.sort();
  }

  onSearchChange() {
    this.applyFilters();
  }

  onCategoryChange() {
    this.applyFilters();
  }

  onCurrencyChange() {
    this.applyFilters();
  }

  onStockChange() {
    this.applyFilters();
  }

  onPriceChange() {
    this.applyFilters();
  }

  resetFilters() {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.selectedCurrency = '';
    this.selectedStock = 'all';
    this.priceFilter.COP = { min: 0, max: this.maxPriceByCurrency.COP };
    this.priceFilter.USD = { min: 0, max: this.maxPriceByCurrency.USD };
    this.applyFilters();
  }

  private updatePriceFilters() {
    const copPrices = this.products.filter(p => p.currency === 'COP').map(p => p.price);
    const usdPrices = this.products.filter(p => p.currency === 'USD').map(p => p.price);

    this.maxPriceByCurrency.COP = copPrices.length ? Math.max(...copPrices) : 0;
    this.maxPriceByCurrency.USD = usdPrices.length ? Math.max(...usdPrices) : 0;

    if (this.priceFilter.COP.max > this.maxPriceByCurrency.COP || this.priceFilter.COP.max === 0) {
      this.priceFilter.COP.max = this.maxPriceByCurrency.COP;
    }

    if (this.priceFilter.USD.max > this.maxPriceByCurrency.USD || this.priceFilter.USD.max === 0) {
      this.priceFilter.USD.max = this.maxPriceByCurrency.USD;
    }
  }

  applyFilters() {
    this.filteredProducts = this.products.filter(product => {
      // Filtro por búsqueda
      const searchMatch = 
        product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(this.searchTerm.toLowerCase());

      // Filtro por categoría
      const categoryMatch = 
        !this.selectedCategory || product.category === this.selectedCategory;

      // Filtro por moneda
      const currencyMatch = 
        !this.selectedCurrency || product.currency === this.selectedCurrency;

      // Filtro por stock
      const stockMatch =
        this.selectedStock === 'all' ||
        (this.selectedStock === 'in' && product.stock > 0) ||
        (this.selectedStock === 'out' && product.stock === 0);

      // Filtro por precio según la moneda del producto
      const currentPriceFilter = this.priceFilter[product.currency];
      const priceMatch = 
        product.price >= currentPriceFilter.min && 
        product.price <= currentPriceFilter.max;

      return searchMatch && categoryMatch && currencyMatch && stockMatch && priceMatch;
    });
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  getResultsText(): string {
    if (this.filteredProducts.length === 0) {
      return 'Sin resultados';
    }
    return `${this.filteredProducts.length} producto${this.filteredProducts.length > 1 ? 's' : ''} encontrado${this.filteredProducts.length > 1 ? 's' : ''}`;
  }
}