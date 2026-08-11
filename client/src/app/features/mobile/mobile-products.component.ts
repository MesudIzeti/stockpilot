import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ProductsService, Product } from '../../core/services/products.service';

@Component({
  selector: 'app-mobile-products',
  imports: [FormsModule, MatCardModule, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="back-row">
      <button mat-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
        Categories
      </button>
    </div>

    <h2 class="page-title">{{ categoryName }}</h2>

    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search products</mat-label>
      <input matInput [(ngModel)]="search" placeholder="Search products…" />
      <mat-icon matSuffix>search</mat-icon>
    </mat-form-field>

    @if (loading) {
      <div class="state-msg">Loading...</div>
    } @else if (filtered.length === 0) {
      <div class="state-msg">No products found.</div>
    } @else {
      <div class="product-list">
        @for (p of filtered; track p.id) {
          <mat-card
            class="product-card"
            [class.card-low]="p.quantity <= p.min_stock_level"
            (click)="goToDetail(p)"
          >
            <mat-card-content>
              <div class="product-row">
                <div class="product-info">
                  <span class="product-name">{{ p.name }}</span>
                  @if (p.sku) {
                    <span class="product-sku">SKU: {{ p.sku }}</span>
                  }
                </div>
                <div class="product-meta">
                  <span class="qty-badge" [class.qty-low]="p.quantity <= p.min_stock_level">
                    {{ p.quantity }} {{ p.unit }}
                  </span>
                  <span class="price">₺{{ p.price }}</span>
                </div>
              </div>
              @if (p.quantity <= p.min_stock_level) {
                <div class="low-stock-row">
                  <mat-icon class="warn-icon">warning</mat-icon>
                  <span>Low stock</span>
                </div>
              }
            </mat-card-content>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .back-row {
      margin-bottom: 4px;
      margin-left: -8px;
    }
    .page-title {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface);
      word-break: break-word;
    }
    .search-field {
      width: 100%;
      margin-bottom: 8px;
    }
    .state-msg {
      text-align: center;
      padding: 48px 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 15px;
    }
    .product-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .product-card {
      cursor: pointer;
      &:active { opacity: 0.8; }
    }
    .card-low {
      border-left: 3px solid var(--mat-sys-error);
    }
    .product-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .product-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .product-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--mat-sys-on-surface);
      word-break: break-word;
    }
    .product-sku {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
      margin-top: 2px;
    }
    .product-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      flex-shrink: 0;
    }
    .qty-badge {
      background-color: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
    }
    .qty-low {
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .price {
      font-size: 14px;
      color: var(--mat-sys-primary);
      font-weight: 500;
    }
    .low-stock-row {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--mat-sys-error);
      margin-top: 8px;
    }
    .warn-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
  `],
})
export class MobileProductsComponent {
  private productsService = inject(ProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  products: Product[] = [];
  loading = true;
  search = '';
  categoryId = 0;
  categoryName = 'Products';

  get filtered(): Product[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.products;
    return this.products.filter(
      p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q),
    );
  }

  constructor() {
    this.categoryId = Number(this.route.snapshot.paramMap.get('id'));
    this.productsService.getByCategory(this.categoryId).subscribe({
      next: (products) => {
        this.products = products;
        if (products.length > 0) {
          this.categoryName = products[0].category_name ?? 'Products';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  goBack() {
    this.router.navigate(['/mobile/categories']);
  }

  goToDetail(product: Product) {
    this.router.navigate(['/mobile/products', product.id]);
  }
}
