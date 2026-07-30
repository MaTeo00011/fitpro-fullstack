import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CartSidebarComponent } from './components/cart-sidebar/cart-sidebar.component';
import { NotificationToastComponent } from './components/notification-toast/notification-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, CartSidebarComponent, NotificationToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'todoapp';
   welcome = 'Hola!';
  tasks = [
    'Instalar Angular',
    'crear proyecto',
    'ver lista en servidor'
  ]
}
