import { Component, inject, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProductsService, Product, ProductPayload, DeletedProduct } from '../../core/services/products.service';
import { CategoriesService, Category, DeletedCategory } from '../../core/services/categories.service';
import { SuppliersService, Supplier } from '../../core/services/suppliers.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { CURRENCIES, symbolFor } from '../../shared/currencies';
import {
  StockMovementService,
  StockMovement,
} from '../../core/services/stock-movement.service';
import { SalesService, SaleItem } from '../../core/services/sales.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

// ── Product form field settings (persisted in localStorage) ──────────────────

const FIELD_SETTINGS_KEY = 'sp_product_form_fields';

interface FieldSettings {
  sku: boolean; cost_price: boolean; min_stock_level: boolean;
  expiry_date: boolean; supplier_id: boolean; description: boolean;
}

const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  sku: true, cost_price: true, min_stock_level: true,
  expiry_date: true, supplier_id: true, description: true,
};

function loadFieldSettings(): FieldSettings {
  try {
    const raw = localStorage.getItem(FIELD_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_FIELD_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_FIELD_SETTINGS };
}

function saveFieldSettings(s: FieldSettings) {
  localStorage.setItem(FIELD_SETTINGS_KEY, JSON.stringify(s));
}

// Cross-field validator: cost_price (when provided) must be > 0 and < price
function costPriceValidator(fieldsGetter: () => FieldSettings): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    if (!fieldsGetter().cost_price) return null;
    const price     = Number(group.get('price')?.value)      || 0;
    const costPrice = Number(group.get('cost_price')?.value) || 0;
    if (!costPrice) return null;
    if (costPrice <= 0)           return { costPriceZero: true };
    if (price > 0 && costPrice >= price) return { costPriceTooHigh: true };
    return null;
  };
}

// ── Add / Edit Product Dialog ─────────────────────────────────────────────────

@Component({
  selector: 'app-product-dialog',
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit Product' : 'Add Product' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">

        <!-- Name + SKU -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Name *</mat-label>
            <input matInput formControlName="name" />
            @if (form.get('name')?.invalid && form.get('name')?.touched) {
              <mat-error>Name is required</mat-error>
            }
          </mat-form-field>
          @if (fields.sku) {
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>SKU (optional)</mat-label>
              <input matInput formControlName="sku" />
            </mat-form-field>
          }
        </div>

        <!-- Price + Cost Price -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Selling Price *</mat-label>
            <input matInput formControlName="price" type="number" min="0.01" step="0.01" />
            @if (form.get('price')?.errors?.['required'] && form.get('price')?.touched) {
              <mat-error>Price is required</mat-error>
            } @else if (form.get('price')?.errors?.['min'] && form.get('price')?.touched) {
              <mat-error>Price must be greater than 0</mat-error>
            }
          </mat-form-field>
          @if (fields.cost_price) {
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Cost Price (optional)</mat-label>
              <input matInput formControlName="cost_price" type="number" min="0.01" step="0.01" />
              <mat-hint>Must be lower than selling price</mat-hint>
            </mat-form-field>
          }
        </div>
        @if (form.errors?.['costPriceTooHigh'] && form.get('cost_price')?.value) {
          <div class="cross-field-error">
            <mat-icon>error_outline</mat-icon>
            Cost price must be lower than the selling price.
          </div>
        }
        @if (form.errors?.['costPriceZero'] && form.get('cost_price')?.value) {
          <div class="cross-field-error">
            <mat-icon>error_outline</mat-icon>
            Cost price must be greater than 0.
          </div>
        }

        <!-- Currency -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Currency *</mat-label>
            <mat-select formControlName="currency">
              @for (c of currencies; track c.code) {
                <mat-option [value]="c.code">{{ c.symbol }} {{ c.code }} — {{ c.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>Changing currency auto-converts the price at today's exchange rate</mat-hint>
          </mat-form-field>
        </div>

        <!-- Quantity + Unit + Min Stock Level -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Quantity *</mat-label>
            <input matInput formControlName="quantity" type="number" [attr.min]="isEdit ? 0 : 1" />
            @if (form.get('quantity')?.errors?.['required'] && form.get('quantity')?.touched) {
              <mat-error>Quantity is required</mat-error>
            } @else if (form.get('quantity')?.errors?.['min'] && form.get('quantity')?.touched) {
              <mat-error>{{ isEdit ? 'Quantity cannot be negative' : 'Minimum 1 unit required for new products' }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Unit *</mat-label>
            <input matInput formControlName="unit" placeholder="pcs / kg / L" />
          </mat-form-field>
          @if (fields.min_stock_level) {
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Min Stock Alert</mat-label>
              <input matInput formControlName="min_stock_level" type="number" min="0" />
            </mat-form-field>
          }
        </div>

        <!-- Category + Supplier -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Category *</mat-label>
            <mat-select formControlName="category_id">
              @for (cat of categories; track cat.id) {
                <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
              }
            </mat-select>
            @if (form.get('category_id')?.invalid && form.get('category_id')?.touched) {
              <mat-error>Category is required</mat-error>
            }
          </mat-form-field>
          @if (fields.supplier_id) {
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Supplier (optional)</mat-label>
              <mat-select formControlName="supplier_id">
                <mat-option [value]="null">— None —</mat-option>
                @for (sup of suppliers; track sup.id) {
                  <mat-option [value]="sup.id">{{ sup.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        </div>

        <!-- Expiry Date -->
        @if (fields.expiry_date) {
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Expiry Date (optional)</mat-label>
              <input matInput formControlName="expiry_date" type="date" />
            </mat-form-field>
          </div>
        }

        <!-- Description -->
        @if (fields.description) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description (optional)</mat-label>
            <textarea matInput formControlName="description" rows="2"></textarea>
          </mat-form-field>
        }

      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="form.invalid">
        {{ isEdit ? 'Save Changes' : 'Add Product' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 0; padding-top: 8px; }
    .form-row { display: flex; gap: 12px; }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
    .full-width { width: 100%; }
    mat-dialog-content { min-width: 540px; max-height: 80vh; }
    .cross-field-error {
      display: flex; align-items: center; gap: 6px;
      margin: -6px 0 8px; padding: 8px 12px; border-radius: 8px;
      background: #FEE2E2; color: #7F1D1D; font-size: 12px; font-weight: 500;
      border-left: 3px solid #DC2626;
    }
    .cross-field-error mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
  `],
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
  ],
})
export class ProductDialogComponent {
  private fb               = inject(FormBuilder);
  private analyticsService = inject(AnalyticsService);
  data = inject<Partial<Product> & { categories: Category[]; suppliers: Supplier[] }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProductDialogComponent>);

  categories = this.data.categories;
  suppliers  = this.data.suppliers;
  isEdit     = !!this.data.id;
  fields     = loadFieldSettings();
  readonly currencies = CURRENCIES;

  // Exchange rates loaded once on open; keyed by currency code, value = units per 1 USD
  private rates: Record<string, number> = {};
  // The currency that was active before the user's last change — used to convert FROM
  private prevCurrency = this.data.currency ?? 'USD';

  form = this.fb.group({
    name:            [this.data.name            ?? '', Validators.required],
    sku:             [this.data.sku             ?? ''],
    description:     [this.data.description     ?? ''],
    price:           [this.data.price           != null ? +this.data.price           : null,
                     [Validators.required, Validators.min(0.01)]],
    cost_price:      [this.data.cost_price      != null ? +this.data.cost_price      : null],
    quantity:        [this.data.quantity        != null ? +this.data.quantity        : (this.isEdit ? 0 : null),
                     [Validators.required, Validators.min(this.isEdit ? 0 : 1)]],
    unit:            [this.data.unit            ?? 'pcs'],
    currency:        [this.data.currency        ?? 'USD', Validators.required],
    min_stock_level: [+(this.data.min_stock_level ?? 0)],
    expiry_date:     [this.data.expiry_date     ?? ''],
    category_id:     [this.data.category_id     ?? null, Validators.required],
    supplier_id:     [this.data.supplier_id     ?? null],
  }, { validators: costPriceValidator(() => this.fields) });

  constructor() {
    // Fetch exchange rates so we can convert prices when the currency changes.
    // The backend caches these for 1 hour, so this is nearly instant.
    this.analyticsService.getExchangeRates().subscribe({
      next: (res) => { this.rates = res.rates; },
      error: () => { /* silent — currency changes will be label-only, no conversion */ },
    });

    // Auto-convert price (and cost price) whenever the user picks a different currency.
    this.form.get('currency')!.valueChanges.subscribe((newCode: string | null) => {
      if (!newCode) return;

      const hasRates = Object.keys(this.rates).length > 0;
      if (hasRates && newCode !== this.prevCurrency) {
        // rates[code] = how many units of that currency equal 1 USD
        // To convert: first go to USD, then to the target currency.
        //   usd_price     = old_price  / old_rate
        //   new_price     = usd_price  * new_rate
        //   => new_price  = old_price  * (new_rate / old_rate)
        const oldRate = this.prevCurrency === 'USD' ? 1.0 : (this.rates[this.prevCurrency] ?? 1.0);
        const newRate = newCode          === 'USD' ? 1.0 : (this.rates[newCode]          ?? 1.0);

        const patch: { price?: number; cost_price?: number } = {};

        const price = Number(this.form.get('price')?.value) || 0;
        if (price > 0) {
          patch.price = +((price / oldRate) * newRate).toFixed(2);
        }

        const costPrice = Number(this.form.get('cost_price')?.value) || 0;
        if (costPrice > 0) {
          patch.cost_price = +((costPrice / oldRate) * newRate).toFixed(2);
        }

        if (Object.keys(patch).length > 0) {
          // emitEvent: false prevents this patchValue from triggering valueChanges
          // on the price/cost_price fields (avoiding accidental validator loops)
          this.form.patchValue(patch, { emitEvent: false });
        }
      }

      this.prevCurrency = newCode;
    });
  }

  save() {
    if (this.form.valid) this.dialogRef.close(this.form.value);
  }
}

// ── Product Form Settings Dialog ──────────────────────────────────────────────

const OPTIONAL_FIELDS: { key: keyof FieldSettings; label: string; hint: string }[] = [
  { key: 'sku',             label: 'SKU',              hint: 'Stock keeping unit / barcode identifier' },
  { key: 'cost_price',      label: 'Cost Price',       hint: 'Purchase cost — used to calculate profit margin' },
  { key: 'min_stock_level', label: 'Min Stock Alert',  hint: 'Trigger low-stock notifications at this threshold' },
  { key: 'expiry_date',     label: 'Expiry Date',      hint: 'Essential for food, medicine, and perishables' },
  { key: 'supplier_id',     label: 'Supplier',         hint: 'Link products to a supplier record' },
  { key: 'description',     label: 'Description',      hint: 'Free-text notes and product details' },
];

@Component({
  selector: 'app-product-form-settings-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Customize Product Form</h2>
    <mat-dialog-content>
      <p class="settings-subtitle">
        Choose which optional fields appear when adding or editing products.
        Core fields — <strong>Name, Price, Category, Quantity, Unit</strong> — are always shown.
      </p>
      <div class="fields-list">
        @for (f of optionalFields; track f.key) {
          <label class="field-row">
            <div class="field-text">
              <span class="field-label">{{ f.label }}</span>
              <span class="field-hint">{{ f.hint }}</span>
            </div>
            <div class="toggle-wrap">
              <input type="checkbox" class="toggle-input" [id]="'field-' + f.key"
                     [checked]="settings[f.key]"
                     (change)="toggle(f.key, $any($event.target).checked)" />
              <span class="toggle-slider"></span>
            </div>
          </label>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()">Save Settings</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 440px; padding-top: 4px !important; }
    .settings-subtitle {
      font-size: 13px; color: var(--mat-sys-on-surface-variant);
      margin: 0 0 16px; line-height: 1.5;
    }
    .fields-list { display: flex; flex-direction: column; }
    .field-row {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 0; border-bottom: 1px solid var(--mat-sys-outline-variant);
      cursor: pointer;
      &:last-child { border-bottom: none; }
    }
    .field-text { display: flex; flex-direction: column; gap: 2px; }
    .field-label { font-size: 14px; font-weight: 500; }
    .field-hint  { font-size: 12px; color: var(--mat-sys-on-surface-variant); }

    /* CSS toggle switch */
    .toggle-wrap { position: relative; flex-shrink: 0; }
    .toggle-input {
      opacity: 0; width: 0; height: 0; position: absolute;
      &:checked + .toggle-slider { background: #4F46E5; }
      &:checked + .toggle-slider::before { transform: translateX(20px); }
    }
    .toggle-slider {
      display: block; width: 44px; height: 24px; border-radius: 12px;
      background: #CBD5E1; cursor: pointer;
      transition: background 0.2s; position: relative;
      &::before {
        content: ''; position: absolute; top: 3px; left: 3px;
        width: 18px; height: 18px; border-radius: 50%;
        background: #fff; transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
    }
  `],
})
export class ProductFormSettingsDialogComponent {
  private dialogRef = inject(MatDialogRef<ProductFormSettingsDialogComponent>);
  readonly optionalFields = OPTIONAL_FIELDS;
  settings: FieldSettings = { ...loadFieldSettings() };

  toggle(key: keyof FieldSettings, value: boolean) {
    this.settings = { ...this.settings, [key]: value };
  }

  save() {
    saveFieldSettings(this.settings);
    this.dialogRef.close(true);
  }
}

// ── Stock History Dialog ──────────────────────────────────────────────────────

@Component({
  selector: 'app-stock-history-dialog',
  imports: [
    CommonModule, MatDialogModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="hist-title-row">
      <mat-icon class="hist-title-icon">history</mat-icon>
      <h2 mat-dialog-title>Stock History — {{ data.product.name }}</h2>
    </div>

    <mat-dialog-content>
      @if (loading) {
        <div class="hist-loading"><mat-spinner diameter="40" /></div>
      } @else if (movements.length === 0) {
        <div class="hist-empty">
          <mat-icon>inventory</mat-icon>
          <p>No stock movements recorded yet.</p>
          <p class="hist-empty-sub">Movements appear here after stock adjustments via the mobile app or sales.</p>
        </div>
      } @else {
        <div class="hist-stock-chip">
          Current stock:
          <strong>{{ data.product.quantity }} {{ data.product.unit }}</strong>
          &nbsp;·&nbsp; {{ movements.length }} movement{{ movements.length !== 1 ? 's' : '' }}
        </div>

        <div class="hist-scroll">
          <table class="hist-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th class="col-qty">Qty</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              @for (m of movements; track m.id) {
                <tr>
                  <td class="hist-date">{{ m.created_at | date:'dd MMM, HH:mm' }}</td>
                  <td>
                    <span class="type-badge" [ngClass]="'badge-' + m.type.toLowerCase()">
                      {{ m.type }}
                    </span>
                  </td>
                  <td class="hist-qty" [ngClass]="qtyClass(m.type)">{{ qtyLabel(m) }}</td>
                  <td class="hist-reason">{{ m.reason }}</td>
                  <td class="hist-by">{{ m.performed_by }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .hist-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 24px 0;
    }
    .hist-title-icon {
      color: var(--mat-sys-primary);
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    h2[mat-dialog-title] {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    mat-dialog-content {
      min-width: 660px;
      max-height: 60vh;
      padding: 16px 24px 8px !important;
    }
    .hist-loading {
      display: flex;
      justify-content: center;
      padding: 48px 0;
    }
    .hist-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 48px 0;
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
    }
    .hist-empty mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.35;
    }
    .hist-empty p { margin: 0; font-size: 14px; }
    .hist-empty-sub { font-size: 12px; opacity: 0.7; }

    .hist-stock-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--mat-sys-surface-container);
      border-radius: 20px;
      padding: 5px 14px;
      font-size: 13px;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 14px;
    }
    .hist-scroll {
      overflow-x: auto;
    }
    .hist-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .hist-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--mat-sys-on-surface-variant);
      padding: 6px 10px;
      border-bottom: 2px solid var(--mat-sys-outline-variant);
      white-space: nowrap;
    }
    .hist-table td {
      padding: 10px 10px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      vertical-align: middle;
    }
    .hist-table tbody tr:last-child td { border-bottom: none; }
    .hist-table tbody tr:hover td {
      background: var(--mat-sys-surface-container-low);
    }
    .hist-date {
      white-space: nowrap;
      color: var(--mat-sys-on-surface-variant);
      font-size: 12px;
    }
    .type-badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .badge-in         { background: #D1FAE5; color: #065F46; }
    .badge-out        { background: #FEF3C7; color: #78350F; }
    .badge-adjustment { background: #EEF2FF; color: #3730A3; }
    .badge-return     { background: #D1FAE5; color: #065F46; }
    .col-qty { text-align: right; }
    .hist-qty {
      font-weight: 700;
      white-space: nowrap;
      text-align: right;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
    .qty-in  { color: #059669; }
    .qty-out { color: #DC2626; }
    .qty-adj { color: #4F46E5; }
    .hist-reason {
      color: var(--mat-sys-on-surface);
      font-size: 12px;
      max-width: 260px;
    }
    .hist-by {
      color: var(--mat-sys-on-surface-variant);
      font-size: 12px;
      white-space: nowrap;
    }
  `],
})
export class StockHistoryDialogComponent {
  data    = inject<{ product: Product }>(MAT_DIALOG_DATA);
  private svc = inject(StockMovementService);
  private cdr = inject(ChangeDetectorRef);

  loading   = true;
  movements: StockMovement[] = [];

  constructor() {
    this.svc.getHistory(this.data.product.id).subscribe({
      next: (res) => {
        this.movements = res.movements;
        this.loading   = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  qtyClass(type: string): string {
    if (type === 'IN' || type === 'RETURN') return 'qty-in';
    if (type === 'OUT') return 'qty-out';
    return 'qty-adj';
  }

  qtyLabel(m: StockMovement): string {
    if (m.type === 'IN' || m.type === 'RETURN') return `+${m.quantity}`;
    if (m.type === 'OUT') return `-${m.quantity}`;
    return `±${m.quantity}`;
  }
}

// ── Add / Edit Category Dialog ────────────────────────────────────────────────

@Component({
  selector: 'app-category-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.id ? 'Edit Category' : 'Add Category' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
          @if (form.get('name')?.invalid && form.get('name')?.touched) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description (optional)</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="form.invalid">
        {{ data.id ? 'Save Changes' : 'Add Category' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 0; padding-top: 8px; }
    .full-width { width: 100%; }
    mat-dialog-content { min-width: 400px; }
  `],
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
  ],
})
export class CategoryDialogComponent {
  private fb = inject(FormBuilder);
  data = inject<Partial<Category>>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CategoryDialogComponent>);

  form = this.fb.group({
    name:        [this.data.name        ?? '', Validators.required],
    description: [this.data.description ?? ''],
  });

  save() {
    if (this.form.valid) this.dialogRef.close(this.form.value);
  }
}

// ── Quick Sell Dialog ─────────────────────────────────────────────────────────

interface QuickSellItem { product: Product; quantity: number; }

@Component({
  selector: 'app-quick-sell-dialog',
  template: `
    <div class="qs-title-row">
      <mat-icon class="qs-title-icon">point_of_sale</mat-icon>
      <h2 mat-dialog-title>Quick Checkout</h2>
    </div>

    <mat-dialog-content>
      @if (items.length === 0) {
        <div class="qs-empty">Cart is empty.</div>
      } @else {
        <table class="qs-table">
          <thead>
            <tr>
              <th>Product</th>
              <th class="qs-right">Unit Price</th>
              <th class="qs-center">Qty</th>
              <th class="qs-right">Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of items; track item.product.id) {
              <tr>
                <td class="qs-name">
                  {{ item.product.name }}
                  <span class="qs-stock">{{ item.product.quantity }} {{ item.product.unit }} in stock</span>
                </td>
                <td class="qs-right">{{ sym(item.product.currency) }}{{ item.product.price | number:'1.2-2' }}</td>
                <td class="qs-center">
                  <input type="number" class="qs-qty-input"
                         [class.qs-qty-error]="item.quantity < 1 || item.quantity > item.product.quantity"
                         min="1" [max]="item.product.quantity"
                         [value]="item.quantity"
                         (input)="updateQty(item, $event)" />
                </td>
                <td class="qs-right qs-subtotal">{{ sym(item.product.currency) }}{{ subtotal(item) | number:'1.2-2' }}</td>
                <td>
                  <button mat-icon-button color="warn" matTooltip="Remove" (click)="removeItem(item)">
                    <mat-icon>remove_circle_outline</mat-icon>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="qs-total-row">
          <span>Grand Total</span>
          @if (cartCurrency) {
            <strong>{{ sym(cartCurrency) }}{{ total | number:'1.2-2' }}</strong>
          } @else if (ratesLoaded) {
            <strong>≈ \${{ totalUSD | number:'1.2-2' }} <span class="qs-mixed">USD equivalent</span></strong>
          } @else {
            <strong>{{ total | number:'1.2-2' }} <span class="qs-mixed">(mixed currencies)</span></strong>
          }
        </div>
      }

      @if (error) {
        <div class="qs-error">{{ error }}</div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [disabled]="selling" mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary"
              [disabled]="items.length === 0 || selling || !isValid()"
              (click)="sell()">
        @if (selling) { Processing… }
        @else if (cartCurrency) { Sell — {{ sym(cartCurrency) }}{{ total | number:'1.2-2' }} }
        @else if (ratesLoaded) { Sell — \${{ totalUSD | number:'1.2-2' }} }
        @else { Confirm Sale }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .qs-title-row {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 24px 0;
    }
    .qs-title-icon { color: var(--mat-sys-primary); font-size: 22px; width: 22px; height: 22px; }
    h2[mat-dialog-title] { margin: 0; font-size: 18px; font-weight: 600; }
    mat-dialog-content { min-width: 600px; max-height: 65vh; padding: 16px 24px 8px !important; }

    .qs-empty {
      text-align: center; padding: 48px 0;
      color: var(--mat-sys-on-surface-variant); font-size: 14px;
    }

    .qs-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .qs-table th {
      text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--mat-sys-on-surface-variant);
      padding: 6px 10px; border-bottom: 2px solid var(--mat-sys-outline-variant);
      white-space: nowrap;
    }
    .qs-table td {
      padding: 10px 10px; border-bottom: 1px solid var(--mat-sys-outline-variant);
      vertical-align: middle;
    }
    .qs-table tbody tr:last-child td { border-bottom: none; }

    .qs-right  { text-align: right; }
    .qs-center { text-align: center; }

    .qs-name { font-weight: 500; max-width: 200px; }
    .qs-stock {
      display: block; font-size: 11px; font-weight: 400;
      color: var(--mat-sys-on-surface-variant); margin-top: 2px;
    }
    .qs-subtotal { font-weight: 600; }

    .qs-qty-input {
      width: 68px; padding: 6px 8px; text-align: center;
      border: 1px solid #E2E8F0; border-radius: 8px;
      font-size: 14px; background: #F8FAFC; color: #0F172A;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .qs-qty-input:focus { outline: none; border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
    .qs-qty-error { border-color: #DC2626 !important; }

    .qs-total-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 10px 0;
      border-top: 2px solid #E2E8F0;
      margin-top: 8px; font-size: 16px; font-weight: 600; color: #64748B;
    }
    .qs-total-row strong { font-size: 22px; color: #4F46E5; font-weight: 800; letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
    .qs-mixed   { font-size: 13px; font-weight: 400; color: #94A3B8; }
    .qs-loading { font-size: 14px; font-weight: 400; color: #94A3B8; font-style: italic; }

    .qs-error {
      margin-top: 14px; padding: 10px 14px; border-radius: 10px;
      background: #FEE2E2; color: #7F1D1D; font-size: 13px; font-weight: 500;
      border-left: 3px solid #DC2626;
    }
  `],
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule,
  ],
})
export class QuickSellDialogComponent {
  private data         = inject<{ items: QuickSellItem[]; rates: Record<string, number> }>(MAT_DIALOG_DATA);
  private salesService = inject(SalesService);
  private dialogRef    = inject(MatDialogRef<QuickSellDialogComponent>);
  private cdr          = inject(ChangeDetectorRef);

  items: QuickSellItem[] = this.data.items.map(i => ({ product: i.product, quantity: 1 }));
  selling = false;
  error   = '';
  // Rates are pre-fetched by ProductsComponent and passed in via dialog data — no async work here.
  private rates: Record<string, number> = this.data.rates ?? {};
  ratesLoaded = Object.keys(this.rates).length > 0;

  sym(code: string): string { return symbolFor(code); }

  subtotal(item: QuickSellItem): number {
    return item.product.price * item.quantity;
  }

  get total(): number {
    return this.items.reduce((sum, i) => sum + this.subtotal(i), 0);
  }

  getProductRate(item: QuickSellItem): number {
    const code = item.product.currency || 'USD';
    if (code === 'USD') return 1.0;
    return this.rates[code] ?? 1.0;
  }

  // USD-normalised total for mixed-currency carts
  get totalUSD(): number {
    return this.items.reduce((sum, i) => sum + this.subtotal(i) / this.getProductRate(i), 0);
  }

  // If all items share one currency → show that symbol; otherwise null (mixed)
  get cartCurrency(): string | null {
    const codes = [...new Set(this.items.map(i => i.product.currency || 'USD'))];
    return codes.length === 1 ? codes[0] : null;
  }

  isValid(): boolean {
    return this.items.every(i => i.quantity >= 1 && i.quantity <= i.product.quantity);
  }

  updateQty(item: QuickSellItem, e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    item.quantity = isNaN(val) || val < 1 ? 1 : Math.floor(Math.min(val, item.product.quantity));
  }

  removeItem(item: QuickSellItem) {
    this.items = this.items.filter(i => i.product.id !== item.product.id);
  }

  sell() {
    if (!this.isValid() || this.selling || this.items.length === 0) return;
    this.selling = true;
    this.error   = '';

    const saleItems: SaleItem[] = this.items.map(i => ({
      product_id: i.product.id,
      quantity:   i.quantity,
      unit_price: i.product.price,
    }));

    this.salesService.createSale(saleItems).subscribe({
      next: () => {
        this.selling = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.selling = false;
        this.error   = err.error?.message || 'Sale failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }
}

// ── Product Restore Dialog ────────────────────────────────────────────────────

@Component({
  selector: 'app-product-restore-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Restore "{{ data.product.name }}"</h2>
    <mat-dialog-content>
      <div class="restore-info">
        <mat-icon>inventory_2</mat-icon>
        <p>
          When this product was deleted, the stock was recorded as
          <strong>{{ data.product.quantity }} {{ data.product.unit }}</strong>.
        </p>
      </div>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Current physical stock count *</mat-label>
        <input matInput type="number" min="0"
               [value]="stockCount"
               (input)="onInput($any($event.target).value)"
               (blur)="onInput($any($event.target).value)" />
        <mat-hint>Count the actual units in your shop right now.</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="stockCount < 0" (click)="confirm()">
        Restore &amp; Set Stock to {{ stockCount }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 420px; padding-top: 8px !important; }
    .restore-info {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px; border-radius: 10px; margin-bottom: 20px;
      background: #EEF2FF; color: #3730A3; font-size: 14px;
    }
    .restore-info mat-icon { color: #4F46E5; flex-shrink: 0; margin-top: 2px; }
    .restore-info p { margin: 0; }
    .full-width { width: 100%; }
  `],
})
export class ProductRestoreDialogComponent {
  data      = inject<{ product: DeletedProduct }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProductRestoreDialogComponent>);

  stockCount = this.data.product.quantity;

  onInput(value: string) {
    const n = Math.floor(Number(value));
    this.stockCount = isNaN(n) || n < 0 ? 0 : n;
  }

  confirm() {
    this.dialogRef.close({ stockCount: this.stockCount });
  }
}

// ── Category Restore Dialog ───────────────────────────────────────────────────

@Component({
  selector: 'app-category-restore-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Restore Category</h2>
    <mat-dialog-content>
      <div class="restore-confirm">
        <mat-icon>label</mat-icon>
        <p>Restore <strong>"{{ data.category.name }}"</strong>?</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="dialogRef.close(true)">Restore</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 360px; padding-top: 8px !important; }
    .restore-confirm {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 8px;
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface-variant); font-size: 14px;
    }
    .restore-confirm mat-icon { color: var(--mat-sys-primary); }
    .restore-confirm p { margin: 0; }
  `],
})
export class CategoryRestoreDialogComponent {
  data      = inject<{ category: DeletedCategory }>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<CategoryRestoreDialogComponent>);
}

// ── Products Page ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatCardModule, MatProgressSpinnerModule, MatTooltipModule,
    MatSnackBarModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent implements OnInit {
  private service           = inject(ProductsService);
  private catService        = inject(CategoriesService);
  private supService        = inject(SuppliersService);
  private salesService      = inject(SalesService);
  private analyticsService  = inject(AnalyticsService);
  private dialog            = inject(MatDialog);
  private snackBar          = inject(MatSnackBar);
  private cdr               = inject(ChangeDetectorRef);

  private exchangeRates: Record<string, number> = {};

  products:          Product[]        = [];
  categories:        Category[]       = [];
  suppliers:         Supplier[]       = [];
  deletedProducts:   DeletedProduct[] = [];
  deletedCategories: DeletedCategory[] = [];
  loading = true;
  productTab:  'active' | 'trash' = 'active';
  categoryTab: 'active' | 'trash' = 'active';
  columns         = ['name', 'price', 'quantity', 'category', 'supplier', 'actions'];
  categoryColumns = ['cat_name', 'cat_product_count', 'cat_actions'];
  deletedProductColumns  = ['dp_name', 'dp_category', 'dp_deleted_at', 'dp_days_left', 'dp_restore'];
  deletedCategoryColumns = ['dc_name', 'dc_deleted_at', 'dc_days_left', 'dc_restore'];
  productSearch  = '';
  categorySearch = '';
  stockFilter: 'all' | 'in-stock' | 'low-stock' | 'out-of-stock' = 'all';
  cart: number[] = [];

  get cartItems(): QuickSellItem[] {
    return this.cart
      .map(id => ({ product: this.products.find(p => p.id === id)!, quantity: 1 }))
      .filter(i => i.product != null);
  }

  isInCart(product: Product): boolean {
    return this.cart.includes(product.id);
  }

  toggleCart(product: Product) {
    this.cart = this.isInCart(product)
      ? this.cart.filter(id => id !== product.id)
      : [...this.cart, product.id];
    this.cdr.markForCheck();
  }

  openCheckout() {
    if (this.cartItems.length === 0) return;
    const ref = this.dialog.open(QuickSellDialogComponent, {
      data: { items: this.cartItems, rates: this.exchangeRates },
      width: '640px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe(sold => {
      if (!sold) return;
      this.cart = [];
      this.snackBar.open('Sale completed successfully', 'Close', { duration: 3000 });
      setTimeout(() => this.load());
    });
  }

  get filteredProducts(): Product[] {
    const term = this.productSearch.toLowerCase().trim();
    let list = term
      ? this.products.filter(p =>
          p.name.toLowerCase().includes(term) ||
          (p.sku && p.sku.toLowerCase().includes(term))
        )
      : this.products;

    switch (this.stockFilter) {
      case 'out-of-stock': return list.filter(p => +p.quantity === 0);
      case 'low-stock':    return list.filter(p => +p.quantity <= +p.min_stock_level && +p.quantity > 0);
      case 'in-stock':     return list.filter(p => +p.quantity > +p.min_stock_level);
      default:             return list;
    }
  }

  get stockCounts() {
    const all      = this.products.length;
    const outStock = this.products.filter(p => +p.quantity === 0).length;
    const lowStock = this.products.filter(p => +p.quantity <= +p.min_stock_level && +p.quantity > 0).length;
    const inStock  = this.products.filter(p => +p.quantity > +p.min_stock_level).length;
    return { all, inStock, lowStock, outStock };
  }

  setStockFilter(f: 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'): void {
    this.stockFilter = f;
    this.cdr.markForCheck();
  }

  get filteredCategories(): Category[] {
    const term = this.categorySearch.toLowerCase().trim();
    if (!term) return this.categories;
    return this.categories.filter(c => c.name.toLowerCase().includes(term));
  }

  onProductSearch(e: Event) {
    this.productSearch = (e.target as HTMLInputElement).value;
    this.cdr.markForCheck();
  }

  onCategorySearch(e: Event) {
    this.categorySearch = (e.target as HTMLInputElement).value;
    this.cdr.markForCheck();
  }

  ngOnInit() {
    this.load();
    // Pre-fetch exchange rates so the QuickSell dialog can use them immediately.
    this.analyticsService.getExchangeRates().subscribe({
      next: (res) => { this.exchangeRates = res.rates; },
      error: () => {},
    });
  }

  load() {
    this.loading = true;
    forkJoin({
      products:          this.service.getAll(),
      categories:        this.catService.getAll(),
      suppliers:         this.supService.getAll(),
      deletedProducts:   this.service.getDeleted(),
      deletedCategories: this.catService.getDeleted(),
    }).subscribe({
      next: (data) => {
        this.products          = data.products;
        this.categories        = data.categories;
        this.suppliers         = data.suppliers;
        this.deletedProducts   = data.deletedProducts;
        this.deletedCategories = data.deletedCategories;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  daysLeft(deletedAt: string): number {
    const msSince = Date.now() - new Date(deletedAt).getTime();
    return Math.max(0, 30 - Math.floor(msSince / (1000 * 60 * 60 * 24)));
  }

  restoreProduct(product: DeletedProduct) {
    const ref = this.dialog.open(ProductRestoreDialogComponent, {
      data: { product },
      width: '480px',
      disableClose: true,
    });
    ref.afterClosed().subscribe((result: { stockCount: number } | undefined) => {
      if (result === undefined) return;
      this.service.restore(product.id, result.stockCount).subscribe({
        next: (res) => {
          this.snackBar.open(res.message, 'Close', { duration: 3500 });
          this.productTab = 'active';
          setTimeout(() => this.load());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Restore failed', 'Close', { duration: 4000 }),
      });
    });
  }

  restoreCategory(category: DeletedCategory) {
    const ref = this.dialog.open(CategoryRestoreDialogComponent, {
      data: { category },
      width: '420px',
    });
    ref.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (!confirmed) return;
      this.catService.restore(category.id).subscribe({
        next: (res) => {
          this.snackBar.open(res.message, 'Close', { duration: 3500 });
          this.categoryTab = 'active';
          setTimeout(() => this.load());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Restore failed', 'Close', { duration: 4000 }),
      });
    });
  }

  openFormSettings() {
    this.dialog.open(ProductFormSettingsDialogComponent, { width: '480px' });
  }

  openDialog(product?: Product) {
    const dialogData = {
      ...(product ?? {}),
      categories: this.categories,
      suppliers:  this.suppliers,
    };
    const ref = this.dialog.open(ProductDialogComponent, { data: dialogData });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const call = product
        ? this.service.update(product.id, result as ProductPayload)
        : this.service.create(result as ProductPayload);
      call.subscribe({
        next: () => {
          this.snackBar.open(product ? 'Product updated' : 'Product added', 'Close', { duration: 3000 });
          setTimeout(() => this.load());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Operation failed', 'Close', { duration: 4000 }),
      });
    });
  }

  openHistory(product: Product) {
    this.dialog.open(StockHistoryDialogComponent, {
      data: { product },
      width: '720px',
    });
  }

  delete(product: Product) {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Product',
        message: `"${product.name}" will be moved to trash for 30 days.`,
        confirmLabel: 'Delete',
      },
      width: '400px',
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.service.delete(product.id).subscribe({
        next: () => { this.snackBar.open('Product deleted', 'Close', { duration: 3000 }); setTimeout(() => this.load()); },
        error: (err) => this.snackBar.open(err.error?.message || 'Cannot delete product', 'Close', { duration: 4000 }),
      });
    });
  }

  openCategoryDialog(category?: Category) {
    const ref = this.dialog.open(CategoryDialogComponent, {
      data: category ?? {},
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const call = category
        ? this.catService.update(category.id, result)
        : this.catService.create(result);
      call.subscribe({
        next: () => {
          this.snackBar.open(category ? 'Category updated' : 'Category added', 'Close', { duration: 3000 });
          setTimeout(() => this.load());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Operation failed', 'Close', { duration: 4000 }),
      });
    });
  }

  deleteCategory(category: Category) {
    if (category.product_count > 0) {
      this.snackBar.open(
        `"${category.name}" has ${category.product_count} active product${category.product_count === 1 ? '' : 's'} — move or delete them first.`,
        'Close',
        { duration: 5000 },
      );
      return;
    }
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Category',
        message: `"${category.name}" will be moved to trash for 30 days.`,
        confirmLabel: 'Delete',
      },
      width: '400px',
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.catService.delete(category.id).subscribe({
        next: () => { this.snackBar.open('Category deleted', 'Close', { duration: 3000 }); setTimeout(() => this.load()); },
        error: (err) => this.snackBar.open(err.error?.message || 'Cannot delete category', 'Close', { duration: 4000 }),
      });
    });
  }

  onImportCsv(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    this.service.import(formData).subscribe({
      next: (res) => {
        this.snackBar.open(res.message, 'Close', { duration: 4000 });
        setTimeout(() => this.load());
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Import failed', 'Close', { duration: 4000 }),
    });
    input.value = '';
  }

  currencySymbol(code: string): string { return symbolFor(code); }
}
