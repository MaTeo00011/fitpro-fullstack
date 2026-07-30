import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CartService } from '../services/cart.service';

@Injectable({
  providedIn: 'root'
})
export class UserAuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private cartService: CartService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.authService.isUser()) {
      return this.router.createUrlTree(['/']);
    }

    const requireCart = route.data?.['requireCart'] ?? false;
    if (requireCart && this.cartService.getTotalItems() === 0) {
      return this.router.createUrlTree(['/home']);
    }

    return true;
  }
}
