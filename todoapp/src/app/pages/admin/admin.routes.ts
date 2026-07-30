import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ProductosComponent } from './productos/productos.component';
import { UsersAdminComponent } from './users-admin/users-admin.component';
import { LoginComponent } from './login/login.component';
import { AdminAuthGuard } from '../../guards/admin-auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AdminAuthGuard]
  },
  {
    path: 'productos',
    component: ProductosComponent,
    canActivate: [AdminAuthGuard]
  },
  {
    path: 'users',
    component: UsersAdminComponent,
    canActivate: [AdminAuthGuard]
  }
];