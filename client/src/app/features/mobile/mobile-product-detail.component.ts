import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductsService, Product } from '../../core/services/products.service';
import { StockMovementService } from '../../core/services/stock-movement.service';

@Component({
  selector: 'app-mobile-product-detail',
  imports: [
    FormsModule,
    MatCardModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatDividerModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="back-row">
      <button mat-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
        Products
      </button>
    </div>

    @if (loading) {
      <div class="state-msg">Loading...</div>
    } @else if (!product) {
      <div class="state-msg">Product not found.</div>
    } @else {
      <h2 class="page-title">{{ product.name }}</h2>

      <!-- Stock overview -->
      <mat-card class="detail-card">
        <mat-card-content>
          <div class="stock-section">
            <span class="stock-label">Current Stock</span>
            <span class="stock-value" [class.stock-low]="product.quantity <= product.min_stock_level">
              {{ product.quantity }}
            </span>
            <span class="stock-unit">{{ product.unit }}</span>
            @if (product.quantity <= product.min_stock_level) {
              <div class="low-badge">
                <mat-icon class="warn-icon">warning</mat-icon>
                Low stock
              </div>
            }
          </div>

          <mat-divider class="divider" />

          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">Category</span>
              <span class="info-value">{{ product.category_name ?? '—' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Price</span>
              <span class="info-value">₺{{ product.price }}</span>
            </div>
            @if (product.cost_price) {
              <div class="info-row">
                <span class="info-label">Cost price</span>
                <span class="info-value">₺{{ product.cost_price }}</span>
              </div>
            }
            @if (product.sku) {
              <div class="info-row">
                <span class="info-label">SKU</span>
                <span class="info-value">{{ product.sku }}</span>
              </div>
            }
            @if (product.supplier_name) {
              <div class="info-row">
                <span class="info-label">Supplier</span>
                <span class="info-value">{{ product.supplier_name }}</span>
              </div>
            }
            <div class="info-row">
              <span class="info-label">Min. stock</span>
              <span class="info-value">{{ product.min_stock_level }} {{ product.unit }}</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Stock adjustment -->
      <mat-card class="adjust-card">
        <mat-card-content>
          <p class="adjust-title">Adjust Stock</p>
          <p class="adjust-hint">Enter a positive number to add stock, negative to remove.</p>

          <mat-form-field appearance="outline" class="adjust-field">
            <mat-label>Quantity change (e.g. -1 or +5)</mat-label>
            <input matInput type="number" [(ngModel)]="adjustment" />
          </mat-form-field>

          @if (adjustment !== 0) {
            <p class="preview">
              {{ product.quantity }} &rarr;
              <strong [class.preview-error]="newQuantity < 0">{{ newQuantity }}</strong>
              {{ product.unit }}
              @if (newQuantity < 0) {
                <span class="preview-error"> — cannot go below 0</span>
              }
            </p>
          }

          @if (successMsg) {
            <div class="success-banner">{{ successMsg }}</div>
          }
          @if (errorMsg) {
            <div class="error-banner">{{ errorMsg }}</div>
          }

          <button
            mat-flat-button
            class="apply-btn"
            [disabled]="saving || adjustment === 0 || newQuantity < 0"
            (click)="applyAdjustment()"
          >
            @if (saving) {
              <ng-container>
                <mat-spinner diameter="20" />
              </ng-container>
            } @else {
              Apply
            }
          </button>
        </mat-card-content>
      </mat-card>
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
    .state-msg {
      text-align: center;
      padding: 48px 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 15px;
    }
    .detail-card {
      margin-bottom: 16px;
    }
    .stock-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0 16px;
    }
    .stock-label {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 4px;
    }
    .stock-value {
      font-size: 56px;
      font-weight: 700;
      color: var(--mat-sys-primary);
      line-height: 1;
    }
    .stock-value.stock-low {
      color: var(--mat-sys-error);
    }
    .stock-unit {
      font-size: 16px;
      color: var(--mat-sys-on-surface-variant);
      margin-top: 4px;
    }
    .low-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--mat-sys-error);
      margin-top: 8px;
    }
    .warn-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .divider {
      margin: 8px 0 16px !important;
    }
    .info-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .info-label {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
    }
    .info-value {
      font-size: 14px;
      font-weight: 500;
      color: var(--mat-sys-on-surface);
    }
    .adjust-card { }
    .adjust-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 4px;
      color: var(--mat-sys-on-surface);
    }
    .adjust-hint {
      font-size: 13px;
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 14px;
    }
    .adjust-field {
      width: 100%;
    }
    .preview {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 12px;
    }
    .preview-error {
      color: var(--mat-sys-error);
    }
    .success-banner {
      background-color: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .error-banner {
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .apply-btn {
      width: 100%;
      height: 48px;
      font-size: 16px;
    }
  `],
})
export class MobileProductDetailComponent {
  private productsService      = inject(ProductsService);
  private stockMovementService = inject(StockMovementService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  product: Product | null = null;
  loading = true;
  saving = false;
  adjustment = 0;
  successMsg = '';
  errorMsg = '';

  get newQuantity(): number {
    return Number(this.product?.quantity ?? 0) + Number(this.adjustment);
  }

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.productsService.getOne(id).subscribe({
      next: (p) => {
        this.product = p;
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
    if (this.product?.category_id) {
      this.router.navigate(['/mobile/categories', this.product.category_id]);
    } else {
      this.router.navigate(['/mobile/categories']);
    }
  }

  applyAdjustment() {
    if (!this.product) return;
    const adj = Number(this.adjustment);
    if (adj === 0) return;
    const newQty = Number(this.product.quantity) + adj;
    if (newQty < 0) return;

    this.saving = true;
    this.successMsg = '';
    this.errorMsg = '';

    const reason = `Mobile adjustment: ${this.product.quantity} → ${newQty} ${this.product.unit}`;

    this.stockMovementService.adjustStock(this.product.id, newQty, reason).subscribe({
      next: (res) => {
        this.product = { ...this.product!, quantity: res.new_quantity };
        this.adjustment = 0;
        this.saving = false;
        this.successMsg = `Stock updated to ${this.product.quantity} ${this.product.unit}`;
        setTimeout(() => {
          this.successMsg = '';
          this.cdr.detectChanges();
        }, 3000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = err.error?.message || 'Failed to update stock. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }
}
