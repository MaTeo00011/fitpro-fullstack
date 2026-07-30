import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductService, Product } from '../../../services/product.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.css'
})
export class ProductosComponent implements OnInit {
  
  products: Product[] = [];
  showModal = false;
  isEditMode = false;
  sidebarOpen = false;
  
  // NUEVO: Para manejar la imagen
  selectedImage: string | null = null;
  imagePreview: string | null = null;
  
  // Modelo del formulario
  productForm = {
    id: 0,
    name: '',
    description: '',
    price: 0,
    currency: 'USD' as 'COP' | 'USD',
    stock: 0,
    icon: '🛍️',
    image: '',
    category: ''

  };

  // Lista de emojis disponibles
  availableIcons = ['🥤', '⚡', '💊', '🔥', '🥛', '💎', '💪', '🏋️', '🎯', '⭐', '🌟', '✨'];

  constructor(private productService: ProductService, private notificationService: NotificationService) {}

  ngOnInit() {
    this.loadProducts();
  }

  // Cargar productos del servicio
  loadProducts() {
    this.productService.products$.subscribe(products => {
      this.products = products;
    });
  }

  // Abrir modal para agregar producto
  openAddModal() {
    this.isEditMode = false;
    this.resetForm();
    this.showModal = true;
  }

  // Abrir modal para editar producto
  openEditModal(product: Product) {
    this.isEditMode = true;
    this.productForm = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      stock: product.stock,
      icon: product.icon,
      image: product.image || '',
      category: product.category || ''
    };
    
    // Mostrar preview de imagen existente
    if (product.image) {
      this.imagePreview = product.image;
    }
    
    this.showModal = true;
  }

  // Cerrar modal
  closeModal() {
    this.showModal = false;
    this.resetForm();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  // Resetear formulario
  resetForm() {
    this.productForm = {
      id: 0,
      name: '',
      description: '',
      price: 0,
      currency: 'USD',
      stock: 0,
      icon: '🛍️',
      image: '',
      category: ''
    };
    this.selectedImage = null;
    this.imagePreview = null;
  }

  // NUEVO: Manejar selección de imagen
  onImageSelected(event: any) {
  const file = event.target.files[0];
  
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    this.notificationService.notify('Por favor selecciona una imagen válida (JPG, PNG, GIF, WEBP).', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e: any) => {
    const img = new Image();
    img.onload = () => {
      // Crear canvas para redimensionar
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400;  // ancho máximo de la tarjeta
      const MAX_HEIGHT = 400; // alto máximo

      let width = img.width;
      let height = img.height;

      // Escalar manteniendo proporción
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height * MAX_WIDTH / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width * MAX_HEIGHT / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // Comprimir a JPEG con calidad 0.7 (70%)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

      this.imagePreview = compressedBase64;
      this.productForm.image = compressedBase64;
    };
    img.src = e.target.result;
  };

  reader.onerror = () => this.notificationService.notify('Error al cargar la imagen.', 'error');
  reader.readAsDataURL(file);
}

  // NUEVO: Eliminar imagen seleccionada
  removeImage() {
    this.imagePreview = null;
    this.productForm.image = '';
    this.selectedImage = null;
    
    // Limpiar el input file
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // Guardar producto (agregar o editar)
  saveProduct() {
    // Validaciones básicas
    if (!this.productForm.name || !this.productForm.description) {
      this.notificationService.notify('Rellena los campos obligatorios del producto.', 'error');
      return;
    }

    if (this.productForm.price <= 0) {
      this.notificationService.notify('El precio debe ser mayor a 0.', 'error');
      return;
    }

    if (this.productForm.stock < 0) {
      this.notificationService.notify('El stock no puede ser negativo.', 'error');
      return;
    }

    if (this.isEditMode) {
      // Actualizar producto existente
      this.productService.updateProduct(this.productForm.id, this.productForm).subscribe(result => {
        if (result) {
          this.notificationService.notify('Producto actualizado exitosamente.', 'success');
          this.closeModal();
        } else {
          this.notificationService.notify('Error al actualizar el producto.', 'error');
        }
      });
    } else {
      // Agregar nuevo producto
      const { id, ...productData } = this.productForm;
      this.productService.addProduct(productData).subscribe(result => {
        if (result) {
          this.notificationService.notify('Producto agregado exitosamente.', 'success');
          this.closeModal();
        } else {
          this.notificationService.notify('Error al agregar el producto.', 'error');
        }
      });
    }
  }

  // Eliminar producto
  deleteProduct(product: Product) {
    const confirmDelete = confirm(
      `¿Estás seguro de eliminar "${product.name}"?\n\nEsta acción no se puede deshacer.`
    );

    if (confirmDelete) {
      this.productService.deleteProduct(product.id).subscribe(success => {
        if (success) {
          this.notificationService.notify('Producto eliminado.', 'success');
        } else {
          this.notificationService.notify('Error al eliminar el producto.', 'error');
        }
      });
    }
  }

  // Formatear precio según moneda
  formatPrice(price: number, currency: string): string {
    if (currency === 'COP') {
      return `$${price.toLocaleString('es-CO')} COP`;
    } else {
      return `$${price.toFixed(2)} USD`;
    }
  }

  // Seleccionar icono
  selectIcon(icon: string) {
    this.productForm.icon = icon;
  }
}