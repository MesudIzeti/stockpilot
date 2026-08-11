import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ownerGuard } from './core/guards/owner.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      { path: 'categories', redirectTo: 'products', pathMatch: 'full' },
      {
        path: 'suppliers',
        loadComponent: () => import('./features/suppliers/suppliers.component').then(m => m.SuppliersComponent),
      },
      {
        path: 'products',
        loadComponent: () => import('./features/products/products.component').then(m => m.ProductsComponent),
      },
      {
        path: 'sales',
        loadComponent: () => import('./features/sales/sales.component').then(m => m.SalesComponent),
      },
      { path: 'returns', redirectTo: 'sales', pathMatch: 'full' },
      {
        path: 'analytics',
        canActivate: [ownerGuard],
        loadComponent: () => import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent),
      },
      {
        path: 'team',
        canActivate: [ownerGuard],
        loadComponent: () => import('./features/team/team.component').then(m => m.TeamComponent),
      },
      {
        path: 'team/:id',
        canActivate: [ownerGuard],
        loadComponent: () => import('./features/team/employee-activity.component').then(m => m.EmployeeActivityComponent),
      },
    ],
  },
  {
    path: 'mobile',
    loadComponent: () => import('./layouts/mobile-layout/mobile-layout.component').then(m => m.MobileLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'categories', pathMatch: 'full' },
      {
        path: 'categories',
        loadComponent: () => import('./features/mobile/mobile-categories.component').then(m => m.MobileCategoriesComponent),
      },
      {
        path: 'categories/:id',
        loadComponent: () => import('./features/mobile/mobile-products.component').then(m => m.MobileProductsComponent),
      },
      {
        path: 'products/:id',
        loadComponent: () => import('./features/mobile/mobile-product-detail.component').then(m => m.MobileProductDetailComponent),
      },
    ],
  },
];
