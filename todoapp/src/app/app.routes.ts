import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LabsComponent } from './pages/labs/labs.component';
import { RegisterComponent } from './pages/register/register.component';
import { LandingComponent } from './pages/landing/landing.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { OrderDetailComponent } from './pages/order-detail/order-detail.component';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';
import { UserAuthGuard } from './guards/user-auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: LandingComponent
    },
    {
        path: 'home',
        component: HomeComponent
    },
    {
        path: 'checkout',
        component: CheckoutComponent,
        canActivate: [UserAuthGuard],
        data: { requireCart: true }
    },
    {
        path: 'product/:id',
        component: ProductDetailComponent
    },
    {
        path: 'order/:id',
        component: OrderDetailComponent,
        canActivate: [UserAuthGuard],
        data: { requireCart: false }
    },
    {
        path: 'labs',
        component: LabsComponent
    },
    {
        path: 'register',
        component: RegisterComponent
    },
    {
        path: 'admin',
        loadChildren: () => import('./pages/admin/admin.routes').then(m => m.ADMIN_ROUTES)
    }
];