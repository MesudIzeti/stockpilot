import { Component, inject, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormArray, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { SalesService, Sale, SaleItem } from '../../core/services/sales.service';
import { ReturnsService, Return, SaleForReturn, SaleReturnItem } from '../../core/services/returns.service';
import { ProductsService, Product } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { symbolFor } from '../../shared/currencies';

// ── New Sale Dialog ───────────────────────────────────────────────────────────

@Component({
  selector: 'app-sale-dialog',
  template: `
    <h2 mat-dialog-title>New Sale</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div formArrayName="items">
          @for (item of items.controls; track $index) {
            <div [formGroupName]="$index" class="item-row">
              <mat-form-field appearance="outline" class="flex-3">
                <mat-label>Product</mat-label>
                <mat-select formControlName="product_id" (openedChange)="onSelectOpen($index, $event)">
                  <div class="search-container" (click)="$event.stopPropagation()">
                    <input
                      class="search-input"
                      placeholder="Search products…"
                      [value]="searchTerms[$index] || ''"
                      (input)="updateSearch($index, $event)"
                      (keydown)="$event.stopPropagation()" />
                  </div>
                  @for (p of filteredProducts($index); track p.id) {
                    <mat-option [value]="p.id">{{ p.name }} ({{ p.quantity }} in stock)</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Qty</mat-label>
                <input matInput formControlName="quantity" type="number" min="1" />
              </mat-form-field>
              @if (getProductPrice($index) > 0) {
                <div class="price-display">
                  <span class="price-label">Unit Price</span>
                  <span class="price-value">{{ getProductSymbol($index) }}{{ getProductPrice($index) | number:'1.2-2' }}</span>
                </div>
              }
              <button mat-icon-button color="warn" type="button"
                (click)="removeItem($index)" [disabled]="items.length === 1"
                class="remove-btn">
                <mat-icon>remove_circle_outline</mat-icon>
              </button>
            </div>
          }
        </div>
        <button mat-button type="button" (click)="addItem()" class="add-item-btn">
          <mat-icon>add</mat-icon> Add Item
        </button>
        <mat-form-field appearance="outline" class="full-width notes-field">
          <mat-label>Notes (optional)</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>
        <div class="total-row">
          <span>Total:</span>
          @if (cartCurrency) {
            <strong>{{ getProductSymbol(0) }}{{ total | number:'1.2-2' }}</strong>
          } @else if (ratesLoaded) {
            <strong>≈ \${{ totalUSD | number:'1.2-2' }} <span class="mixed-note">USD equivalent</span></strong>
          } @else {
            <strong>{{ total | number:'1.2-2' }} <span class="mixed-note">(mixed currencies)</span></strong>
          }
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="form.invalid">Record Sale</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; padding-top: 8px; }
    .item-row { display: flex; gap: 10px; align-items: center; }
    .flex-1 { flex: 1; }
    .flex-3 { flex: 3; }
    .remove-btn { flex-shrink: 0; margin-top: -20px; }
    .add-item-btn { align-self: flex-start; margin-bottom: 8px; color: #4F46E5 !important; font-weight: 600; }
    .full-width { width: 100%; }
    .notes-field { margin-top: 4px; }
    .total-row {
      display: flex; justify-content: flex-end; align-items: center; gap: 12px;
      font-size: 1.05rem; font-weight: 600; color: #64748B; padding: 12px 4px;
      border-top: 2px solid #E2E8F0;
      margin-top: 4px;
    }
    .total-row strong { font-size: 1.25rem; color: #4F46E5; font-weight: 800; font-variant-numeric: tabular-nums; }
    .mixed-note   { font-size: 0.75rem; font-weight: 400; color: #94A3B8; }
    .loading-rates { font-size: 0.85rem; font-style: italic; color: #94A3B8; }
    .price-display {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-width: 84px; padding: 0 6px; margin-top: -20px;
    }
    .price-label { font-size: 10.5px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; }
    .price-value { font-size: 14px; font-weight: 700; color: #4F46E5; font-variant-numeric: tabular-nums; }
    mat-dialog-content { min-width: 580px; max-height: 80vh; }
    .search-container { padding: 8px 12px; border-bottom: 1px solid #E2E8F0; position: sticky; top: 0; background: #fff; z-index: 1; }
    .search-input { width: 100%; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 10px; font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit; }
    .search-input:focus { border-color: #4F46E5; }
  `],
  imports: [
    ReactiveFormsModule, CommonModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
  ],
})
export class SaleDialogComponent {
  private fb        = inject(FormBuilder);
  private data      = inject<{ products: Product[]; rates: Record<string, number> }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<SaleDialogComponent>);

  products = this.data.products;
  // Rates are pre-fetched by SalesComponent and passed in via dialog data — no async work here.
  private rates: Record<string, number> = this.data.rates ?? {};
  ratesLoaded = Object.keys(this.rates).length > 0;

  form = this.fb.group({
    items: this.fb.array([this.newItem()]),
    notes: [''],
  });

  get items() { return this.form.get('items') as FormArray; }

  getProduct(index: number): Product | undefined {
    const id = this.items.at(index).get('product_id')?.value;
    return this.products.find(p => p.id === id);
  }

  getProductPrice(index: number): number {
    return this.getProduct(index)?.price ?? 0;
  }

  getProductSymbol(index: number): string {
    return symbolFor(this.getProduct(index)?.currency ?? 'USD');
  }

  get cartCurrency(): string | null {
    const codes = [...new Set(
      this.items.controls
        .map((_, i) => this.getProduct(i)?.currency ?? 'USD')
        .filter((_, i) => this.getProductPrice(i) > 0)
    )];
    return codes.length === 1 ? codes[0] : null;
  }

  get total(): number {
    return this.items.controls.reduce((sum, ctrl, i) => {
      const qty   = Number(ctrl.get('quantity')?.value) || 0;
      const price = this.getProductPrice(i);
      return sum + qty * price;
    }, 0);
  }

  getProductRate(index: number): number {
    const code = this.getProduct(index)?.currency ?? 'USD';
    if (code === 'USD') return 1.0;
    return this.rates[code] ?? 1.0;
  }

  get totalUSD(): number {
    return this.items.controls.reduce((sum, ctrl, i) => {
      const qty   = Number(ctrl.get('quantity')?.value) || 0;
      const price = this.getProductPrice(i);
      const rate  = this.getProductRate(i);
      return sum + (qty * price) / rate;
    }, 0);
  }

  newItem() {
    return this.fb.group({
      product_id: [null, Validators.required],
      quantity:   [1,    [Validators.required, Validators.min(1)]],
    });
  }

  searchTerms: string[] = [''];

  filteredProducts(index: number): Product[] {
    const term = (this.searchTerms[index] ?? '').trim().toLowerCase();
    if (!term) return this.products;
    return this.products.filter(p => p.name.toLowerCase().includes(term));
  }

  updateSearch(index: number, event: Event) {
    this.searchTerms[index] = (event.target as HTMLInputElement).value;
  }

  onSelectOpen(index: number, opened: boolean) {
    if (!opened) this.searchTerms[index] = '';
  }

  addItem() { this.items.push(this.newItem()); this.searchTerms.push(''); }
  removeItem(i: number) { this.items.removeAt(i); this.searchTerms.splice(i, 1); }

  save() {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}

// ── Process Return Dialog ─────────────────────────────────────────────────────

interface ItemReturnEntry { selected: boolean; quantity: number; }

@Component({
  selector: 'app-return-dialog',
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Process Return — Sale #{{ data.saleId }}</h2>

    <mat-dialog-content>

      @if (loadingSale) {
        <div class="rd-loading"><mat-spinner diameter="40" /></div>
      } @else if (saleError) {
        <div class="rd-error">{{ saleError }}</div>
      } @else if (saleData) {

        @if (saleData.already_returned) {
          <div class="already-returned">
            <mat-icon>check_circle</mat-icon>
            <p>All items in Sale #{{ data.saleId }} have already been fully returned.</p>
          </div>
        } @else {

          <div class="sale-summary">
            <span>Sale #{{ data.saleId }}</span>
            <span>{{ saleData.sale.created_at | date:'mediumDate' }}</span>
            <span class="sale-total">{{ saleData.sale.total_amount | number:'1.2-2' }}</span>
          </div>

          <p class="section-label">Select items &amp; quantities to return</p>
          <div class="items-list">
            @for (item of saleData.items; track item.id) {
              <div class="item-row" [class.item-row--returned]="item.is_returned">

                @if (item.is_returned) {
                  <div class="item-info item-info--faded">
                    <span class="item-name">{{ item.product_name }}</span>
                    <span class="item-detail">All {{ item.quantity }} {{ item.unit }} returned</span>
                  </div>
                  <span class="item-returned-badge">Returned</span>
                } @else {
                  <div class="item-left">
                    <mat-checkbox
                      [checked]="getEntry(item.id).selected"
                      (change)="toggleItem(item)">
                      <div class="item-info">
                        <span class="item-name">{{ item.product_name }}</span>
                        <span class="item-detail">
                          {{ sym(item.currency) }}{{ item.unit_price | number:'1.2-2' }} each
                          @if (item.returned_quantity > 0) {
                            &middot; <em>{{ item.returned_quantity }} of {{ item.quantity }} already returned</em>
                          }
                        </span>
                      </div>
                    </mat-checkbox>
                  </div>

                  @if (getEntry(item.id).selected) {
                    <div class="qty-wrap">
                      <button mat-icon-button class="qty-btn"
                              [disabled]="getEntry(item.id).quantity <= 1"
                              (click)="adjustQty(item.id, -1)">
                        <mat-icon>remove</mat-icon>
                      </button>
                      <input type="number" class="qty-input"
                             [value]="getEntry(item.id).quantity"
                             [min]="1" [max]="item.remaining_quantity"
                             (change)="setQty(item.id, +$any($event.target).value, item.remaining_quantity)"
                             (blur)="setQty(item.id, +$any($event.target).value, item.remaining_quantity)" />
                      <button mat-icon-button class="qty-btn"
                              [disabled]="getEntry(item.id).quantity >= item.remaining_quantity"
                              (click)="adjustQty(item.id, 1, item.remaining_quantity)">
                        <mat-icon>add</mat-icon>
                      </button>
                      <span class="qty-max">/ {{ item.remaining_quantity }}</span>
                    </div>
                  }
                }

              </div>
            }
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason *</mat-label>
            <mat-select [(ngModel)]="reason">
              <mat-option value="refund">Refund — customer disliked product (stock restored)</mat-option>
              <mat-option value="exchange">Exchange — customer wants a replacement (stock restored)</mat-option>
              <mat-option value="warranty">Warranty — defective/broken product (stock NOT restored)</mat-option>
            </mat-select>
          </mat-form-field>

          @if (reason === 'warranty') {
            <div class="warranty-warning">
              <mat-icon>warning</mat-icon>
              <span>Defective return — selected units will be written off. Stock will <strong>not</strong> be restored.</span>
            </div>
          }

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Notes (optional)</mat-label>
            <textarea matInput [(ngModel)]="notes" rows="2"></textarea>
          </mat-form-field>

          <div class="refund-row">
            <span>Refund Total (USD)</span>
            <strong class="refund-amount">\${{ totalRefund | number:'1.2-2' }}</strong>
          </div>

        }
      }

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      @if (saleData && !saleData.already_returned) {
        <button mat-flat-button color="primary" (click)="confirm()" [disabled]="!canSubmit">
          Confirm Return
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 540px; max-height: 75vh; padding-top: 8px !important; }
    .rd-loading { display: flex; justify-content: center; padding: 48px 0; }
    .rd-error { color: var(--mat-sys-error); padding: 16px 0; font-size: 14px; }
    .already-returned {
      display: flex; align-items: center; gap: 12px;
      padding: 16px; border-radius: 12px;
      background: #D1FAE5; color: #065F46;
    }
    .already-returned mat-icon { color: #059669; }
    .sale-summary {
      display: flex; gap: 16px; align-items: center;
      padding: 10px 16px; border-radius: 10px;
      background: #F8FAFC; border: 1px solid #E2E8F0;
      font-size: 14px; margin-bottom: 16px; color: #64748B;
    }
    .sale-total { font-weight: 700; margin-left: auto; color: #0F172A; font-variant-numeric: tabular-nums; }
    .section-label {
      font-size: 11px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.7px; color: #94A3B8;
      margin: 0 0 10px;
    }
    .items-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .item-row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0;
      background: #FFFFFF; transition: border-color 0.15s;
    }
    .item-row:hover { border-color: #CBD5E1; }
    .item-row--returned { opacity: 0.5; background: var(--mat-sys-surface-container, #f5f5f5); }
    .item-left { flex: 1; min-width: 0; }
    .item-returned-badge {
      font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 10px;
      background: #D1FAE5; color: #065F46; white-space: nowrap; flex-shrink: 0;
    }
    .item-info { display: flex; flex-direction: column; gap: 2px; }
    .item-info--faded { flex: 1; }
    .item-name { font-size: 14px; font-weight: 500; }
    .item-detail { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
    .qty-wrap {
      display: flex; align-items: center; gap: 2px; flex-shrink: 0;
    }
    .qty-btn { width: 30px; height: 30px; line-height: 30px; }
    .qty-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .qty-input {
      width: 48px; text-align: center; border: 1px solid #E2E8F0;
      border-radius: 8px; padding: 5px 4px; font-size: 14px; font-family: 'Inter', system-ui, sans-serif;
      background: #F8FAFC; color: #0F172A;
    }
    .qty-input:focus { outline: none; border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
    .qty-max { font-size: 12px; color: var(--mat-sys-on-surface-variant); margin-left: 4px; }
    .full-width { width: 100%; }
    .warranty-warning {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 10px 14px; border-radius: 10px; margin-bottom: 12px;
      background: #FFFBEB; color: #92400E; font-size: 13px; font-weight: 500;
      border-left: 3px solid #D97706;
    }
    .warranty-warning mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
    .refund-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 4px; margin-top: 8px;
      border-top: 2px solid #E2E8F0;
      font-size: 15px; font-weight: 600; color: #64748B;
    }
    .refund-amount { font-size: 20px; color: #059669; font-weight: 800; font-variant-numeric: tabular-nums; }
  `],
})
export class ReturnDialogComponent implements OnInit {
  data      = inject<{ saleId: number }>(MAT_DIALOG_DATA);
  private svc       = inject(ReturnsService);
  private cdr       = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<ReturnDialogComponent>);

  sym(code: string | undefined): string { return symbolFor(code ?? 'USD'); }

  loadingSale = true;
  saleError   = '';
  saleData: SaleForReturn | null = null;
  itemEntries = new Map<number, ItemReturnEntry>();
  reason  = '';
  notes   = '';

  ngOnInit() {
    this.svc.getSaleForReturn(this.data.saleId).subscribe({
      next: (data) => {
        this.saleData    = data;
        this.loadingSale = false;
        data.items.filter(i => !i.is_returned).forEach(i =>
          this.itemEntries.set(i.id, { selected: true, quantity: i.remaining_quantity })
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saleError   = err.error?.message || 'Could not load sale details.';
        this.loadingSale = false;
        this.cdr.detectChanges();
      },
    });
  }

  getEntry(id: number): ItemReturnEntry {
    return this.itemEntries.get(id) ?? { selected: false, quantity: 0 };
  }

  toggleItem(item: SaleReturnItem) {
    const e = this.itemEntries.get(item.id);
    if (e) e.selected = !e.selected;
  }

  adjustQty(id: number, delta: number, max?: number) {
    const e = this.itemEntries.get(id);
    if (!e) return;
    const newQty = e.quantity + delta;
    e.quantity = Math.max(1, max !== undefined ? Math.min(newQty, max) : newQty);
  }

  setQty(id: number, value: number, max: number) {
    const e = this.itemEntries.get(id);
    if (!e) return;
    e.quantity = Math.max(1, Math.min(Math.floor(value) || 1, max));
  }

  get totalRefund(): number {
    if (!this.saleData) return 0;
    return this.saleData.items.reduce((sum, i) => {
      const e = this.itemEntries.get(i.id);
      if (!e?.selected) return sum;
      const rate = Number(i.exchange_rate) || 1.0;
      return sum + (Number(i.unit_price) * e.quantity) / rate;
    }, 0);
  }

  get canSubmit(): boolean {
    return Array.from(this.itemEntries.values()).some(e => e.selected && e.quantity > 0) && !!this.reason;
  }

  confirm() {
    if (!this.canSubmit) return;
    const items = this.saleData!.items
      .filter(i => !i.is_returned)
      .map(i => ({ sale_item_id: i.id, entry: this.itemEntries.get(i.id)! }))
      .filter(x => x.entry.selected && x.entry.quantity > 0)
      .map(x => ({ sale_item_id: x.sale_item_id, quantity: x.entry.quantity }));

    this.dialogRef.close({
      saleId: this.data.saleId,
      reason: this.reason,
      items,
      notes:  this.notes,
    });
  }
}

// ── Sales & Returns Page ──────────────────────────────────────────────────────

@Component({
  selector: 'app-sales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatCardModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatTooltipModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule,
  ],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss',
})
export class SalesComponent implements OnInit {
  private salesService     = inject(SalesService);
  private returnsService   = inject(ReturnsService);
  private productsService  = inject(ProductsService);
  private analyticsService = inject(AnalyticsService);
  private authService      = inject(AuthService);
  private dialog           = inject(MatDialog);
  private snackBar         = inject(MatSnackBar);
  private cdr              = inject(ChangeDetectorRef);

  private exchangeRates: Record<string, number> = {};

  sales:    Sale[]    = [];
  returns:  Return[]  = [];
  products: Product[] = [];
  loading  = true;
  productFilter = '';
  startDate: Date | null = null;
  endDate:   Date | null = null;

  isEmployee = this.authService.isEmployee();

  salesColumns   = ['id', 'product_names', 'category_names', 'total_amount', 'item_count', 'performed_by', 'created_at', 'return_status', 'actions'];
  returnsColumns = ['return_number', 'sale_id', 'product_names', 'reason', 'total_refund', 'performed_by', 'created_at'];

  private applyDateFilter<T extends { created_at: string }>(list: T[]): T[] {
    if (!this.startDate || !this.endDate) return list;
    const from   = this.startDate;
    const to     = new Date(this.endDate);
    to.setHours(23, 59, 59, 999);
    return list.filter(item => {
      const d = new Date(item.created_at);
      return d >= from && d <= to;
    });
  }

  get filteredSales(): Sale[] {
    const term = this.productFilter.trim().toLowerCase();
    const byName = term
      ? this.sales.filter(s => (s.product_names ?? '').toLowerCase().includes(term))
      : this.sales;
    return this.applyDateFilter(byName);
  }

  get filteredReturns(): Return[] {
    return this.applyDateFilter(this.returns);
  }

  ngOnInit() {
    this.load();
    // Pre-fetch exchange rates so the New Sale dialog can use them immediately.
    this.analyticsService.getExchangeRates().subscribe({
      next: (res) => { this.exchangeRates = res.rates; },
      error: () => {},
    });
  }

  load() {
    this.loading = true;
    forkJoin({
      sales:    this.salesService.getSales(),
      returns:  this.returnsService.getReturns(),
      products: this.productsService.getAll(),
    }).subscribe({
      next: (data) => {
        this.sales    = data.sales;
        this.returns  = data.returns;
        this.products = data.products;
        this.loading  = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  onFilter(e: Event) {
    this.productFilter = (e.target as HTMLInputElement).value;
    this.cdr.markForCheck();
  }

  onPickerClosed() {
    this.cdr.markForCheck();
  }

  clearDateFilter() {
    this.startDate = null;
    this.endDate   = null;
    this.cdr.markForCheck();
  }

  openNewSaleDialog() {
    if (!this.products.length) {
      this.snackBar.open('No products available. Add products first.', 'Close', { duration: 4000 });
      return;
    }
    const ref = this.dialog.open(SaleDialogComponent, {
      data: { products: this.products, rates: this.exchangeRates },
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const items: SaleItem[] = result.items;
      this.salesService.createSale(items, result.notes || undefined).subscribe({
        next: () => {
          this.snackBar.open('Sale recorded', 'Close', { duration: 3000 });
          setTimeout(() => this.load());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Failed to record sale', 'Close', { duration: 4000 }),
      });
    });
  }

  openReturnDialog(sale: Sale) {
    const ref = this.dialog.open(ReturnDialogComponent, {
      data: { saleId: sale.id },
      width: '580px',
      disableClose: true,
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.returnsService.createReturn(result.saleId, result.reason, result.items, result.notes).subscribe({
        next: (res) => {
          const refund = Number(res.return.total_refund).toFixed(2);
          const msg = result.reason === 'warranty'
            ? `Return #${res.return.return_number} logged — defective item written off ($${refund})`
            : `Return #${res.return.return_number} processed — $${refund} refunded, stock restored`;
          this.snackBar.open(msg, 'Close', { duration: 5000 });
          setTimeout(() => this.load());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Failed to process return', 'Close', { duration: 4000 }),
      });
    });
  }

  reasonLabel(reason: string): string {
    const map: Record<string, string> = { refund: 'Refund', warranty: 'Warranty', exchange: 'Exchange' };
    return map[reason] ?? reason;
  }

  symFor(code: string | null | undefined): string { return symbolFor(code ?? 'USD'); }
}
