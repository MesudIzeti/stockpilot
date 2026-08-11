import { Component, inject, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SuppliersService, Supplier } from '../../core/services/suppliers.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import {
  PurchaseOrdersService,
  PurchaseOrder,
  ReorderCandidate,
} from '../../core/services/purchase-orders.service';

// ── Add / Edit Supplier Dialog ────────────────────────────────────────────────

@Component({
  selector: 'app-supplier-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.id ? 'Edit Supplier' : 'Add Supplier' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="Supplier name" />
          @if (form.get('name')?.invalid && form.get('name')?.touched) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email (optional)</mat-label>
          <input matInput formControlName="email" type="email" placeholder="contact@supplier.com" />
          @if (form.get('email')?.errors?.['email'] && form.get('email')?.touched) {
            <mat-error>Invalid email address</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Phone (optional)</mat-label>
          <input matInput formControlName="phone" placeholder="+1 555 000 0000" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Address (optional)</mat-label>
          <textarea matInput formControlName="address" rows="2"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notes (optional)</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="form.invalid">
        {{ data.id ? 'Save Changes' : 'Add Supplier' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; padding-top: 8px; }
    .full-width { width: 100%; }
    mat-dialog-content { min-width: 440px; }
  `],
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
  ],
})
export class SupplierDialogComponent {
  private fb = inject(FormBuilder);
  data = inject<Partial<Supplier>>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<SupplierDialogComponent>);

  form = this.fb.group({
    name:    [this.data.name    ?? '', Validators.required],
    email:   [this.data.email   ?? '', Validators.email],
    phone:   [this.data.phone   ?? ''],
    address: [this.data.address ?? ''],
    notes:   [this.data.notes   ?? ''],
  });

  save() {
    if (this.form.valid) this.dialogRef.close(this.form.value);
  }
}

// ── Reorder Dialog ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-reorder-dialog',
  template: `
    <div class="rd-title-row">
      <mat-icon class="rd-title-icon">local_shipping</mat-icon>
      <h2 mat-dialog-title>Place Reorder — {{ data.supplier.name }}</h2>
    </div>

    <mat-dialog-content>
      @if (loading) {
        <div class="rd-loading"><mat-spinner diameter="40" /></div>
      } @else if (candidates.length === 0) {
        <div class="rd-empty">
          <mat-icon>check_circle_outline</mat-icon>
          <p>All products from this supplier are well stocked.</p>
          <span>No items are out of stock or below minimum level.</span>
        </div>
      } @else {
        <p class="rd-hint">
          Enter the quantity to order for each product. Only out-of-stock and
          low-stock items linked to this supplier are shown.
        </p>
        <table class="rd-table">
          <thead>
            <tr>
              <th>Product</th>
              <th class="rd-center">In Stock</th>
              <th class="rd-center">Min Level</th>
              <th class="rd-center">Order Qty</th>
            </tr>
          </thead>
          <tbody>
            @for (c of candidates; track c.id) {
              <tr>
                <td class="rd-name">
                  {{ c.name }}
                  <span class="rd-cat">{{ c.category_name }}</span>
                  @if (c.quantity === 0) {
                    <span class="rd-badge-out">OUT OF STOCK</span>
                  }
                </td>
                <td class="rd-center" [class.rd-zero]="c.quantity === 0">
                  {{ c.quantity }} {{ c.unit }}
                </td>
                <td class="rd-center">{{ c.min_stock_level }}</td>
                <td class="rd-center">
                  <input type="number" class="rd-qty-input"
                         min="0" [value]="getQty(c.id)"
                         (input)="setQty(c.id, $event)" />
                </td>
              </tr>
            }
          </tbody>
        </table>

        <mat-form-field appearance="outline" class="rd-notes-field">
          <mat-label>Order notes (optional)</mat-label>
          <input matInput [value]="notes" (input)="setNotes($event)"
                 placeholder="e.g. urgent, call before delivery…" />
        </mat-form-field>
      }

      @if (error) {
        <div class="rd-error">{{ error }}</div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="submitting">Cancel</button>
      <button mat-flat-button color="primary"
              [disabled]="submitting || candidates.length === 0 || !hasAnyQty()"
              (click)="submit()">
        @if (submitting) { Placing Order… }
        @else { Place Order }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .rd-title-row {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 24px 0;
    }
    .rd-title-icon { color: var(--mat-sys-primary); font-size: 22px; width: 22px; height: 22px; }
    h2[mat-dialog-title] { margin: 0; font-size: 18px; font-weight: 600; }
    mat-dialog-content { min-width: 580px; max-height: 65vh; padding: 16px 24px 8px !important; }

    .rd-loading { display: flex; justify-content: center; padding: 48px 0; }

    .rd-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 40px 0; text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .rd-empty mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.4; }
    .rd-empty p { margin: 0; font-size: 15px; }
    .rd-empty span { font-size: 13px; opacity: 0.7; }

    .rd-hint { font-size: 13px; color: var(--mat-sys-on-surface-variant); margin-bottom: 12px; }

    .rd-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px; }
    .rd-table th {
      text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--mat-sys-on-surface-variant);
      padding: 6px 10px; border-bottom: 2px solid var(--mat-sys-outline-variant);
    }
    .rd-table td {
      padding: 10px 10px; border-bottom: 1px solid var(--mat-sys-outline-variant);
      vertical-align: middle;
    }
    .rd-table tbody tr:last-child td { border-bottom: none; }

    .rd-center { text-align: center; }
    .rd-name { font-weight: 500; }
    .rd-cat {
      display: block; font-size: 11px; font-weight: 400;
      color: var(--mat-sys-on-surface-variant); margin-top: 2px;
    }
    .rd-badge-out {
      display: inline-block; margin-left: 6px;
      padding: 1px 6px; border-radius: 4px;
      background: #FEE2E2; color: #DC2626;
      font-size: 10px; font-weight: 700; letter-spacing: 0.4px;
    }
    .rd-zero { color: #DC2626; font-weight: 600; }

    .rd-qty-input {
      width: 72px; padding: 6px 8px; text-align: center;
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 4px;
      font-size: 14px; background: var(--mat-sys-surface); color: var(--mat-sys-on-surface);
    }
    .rd-qty-input:focus { outline: none; border-color: var(--mat-sys-primary); }

    .rd-notes-field { width: 100%; }

    .rd-error {
      margin-top: 12px; padding: 10px 14px; border-radius: 6px;
      background: #FEE2E2; color: #DC2626; font-size: 13px;
    }
  `],
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
  ],
})
export class ReorderDialogComponent {
  data          = inject<{ supplier: Supplier }>(MAT_DIALOG_DATA);
  private poService = inject(PurchaseOrdersService);
  private dialogRef = inject(MatDialogRef<ReorderDialogComponent>);
  private cdr       = inject(ChangeDetectorRef);

  candidates: ReorderCandidate[] = [];
  quantities: Record<number, number> = {};
  notes      = '';
  loading    = true;
  submitting = false;
  error      = '';

  constructor() {
    this.poService.getReorderCandidates(this.data.supplier.id).subscribe({
      next: (data) => {
        this.candidates = data;
        this.loading    = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error   = 'Failed to load products for this supplier.';
        this.cdr.detectChanges();
      },
    });
  }

  getQty(productId: number): number {
    return this.quantities[productId] ?? 0;
  }

  setQty(productId: number, e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.quantities[productId] = isNaN(val) || val < 0 ? 0 : Math.floor(val);
  }

  setNotes(e: Event) {
    this.notes = (e.target as HTMLInputElement).value;
  }

  hasAnyQty(): boolean {
    return Object.values(this.quantities).some(q => q > 0);
  }

  submit() {
    const items = this.candidates
      .filter(c => (this.quantities[c.id] ?? 0) > 0)
      .map(c => ({ product_id: c.id, quantity_ordered: this.quantities[c.id] }));

    if (items.length === 0) return;

    this.submitting = true;
    this.error      = '';

    this.poService.createOrder(this.data.supplier.id, items, this.notes || undefined).subscribe({
      next: () => {
        this.submitting = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.submitting = false;
        this.error      = err.error?.message || 'Failed to place order. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }
}

// ── Suppliers Page ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-suppliers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatCardModule, MatProgressSpinnerModule, MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.scss',
})
export class SuppliersComponent implements OnInit {
  private service   = inject(SuppliersService);
  private poService = inject(PurchaseOrdersService);
  private dialog    = inject(MatDialog);
  private snackBar  = inject(MatSnackBar);
  private cdr       = inject(ChangeDetectorRef);

  suppliers:    Supplier[]      = [];
  activeOrders: PurchaseOrder[] = [];
  loading = true;
  columns = ['name', 'email', 'phone', 'address', 'actions'];

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loading = true;
    forkJoin({
      suppliers: this.service.getAll(),
      orders:    this.poService.getOrders(),
    }).subscribe({
      next: (data) => {
        this.suppliers    = data.suppliers;
        this.activeOrders = data.orders;
        this.loading      = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  hasActiveOrder(supplier: Supplier): boolean {
    return this.activeOrders.some(o => o.supplier_id === supplier.id);
  }

  openDialog(supplier?: Supplier) {
    const ref = this.dialog.open(SupplierDialogComponent, { data: supplier ?? {} });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const call = supplier
        ? this.service.update(supplier.id, result)
        : this.service.create(result);
      call.subscribe({
        next: () => {
          this.snackBar.open(supplier ? 'Supplier updated' : 'Supplier added', 'Close', { duration: 3000 });
          setTimeout(() => this.loadAll());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Operation failed', 'Close', { duration: 4000 }),
      });
    });
  }

  delete(supplier: Supplier) {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Supplier',
        message: `"${supplier.name}" will be permanently removed.`,
        confirmLabel: 'Delete',
      },
      width: '400px',
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.service.delete(supplier.id).subscribe({
        next: () => {
          this.snackBar.open('Supplier deleted', 'Close', { duration: 3000 });
          setTimeout(() => this.loadAll());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Cannot delete supplier', 'Close', { duration: 4000 }),
      });
    });
  }

  openReorder(supplier: Supplier) {
    const ref = this.dialog.open(ReorderDialogComponent, {
      data: { supplier },
      width: '640px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe(created => {
      if (!created) return;
      this.snackBar.open('Purchase order placed — items marked in transit', 'Close', { duration: 3500 });
      setTimeout(() => this.loadAll());
    });
  }

  receiveOrder(order: PurchaseOrder) {
    this.poService.receiveOrder(order.id).subscribe({
      next: () => {
        this.snackBar.open(
          `Order received — stock updated for ${order.items.length} product(s)`,
          'Close', { duration: 3500 }
        );
        setTimeout(() => this.loadAll());
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to receive order', 'Close', { duration: 4000 }),
    });
  }

  cancelOrder(order: PurchaseOrder) {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Cancel Purchase Order',
        message: `Cancel this purchase order from ${order.supplier_name}? This cannot be undone.`,
        confirmLabel: 'Cancel Order',
        icon: 'block',
      },
      width: '400px',
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.poService.cancelOrder(order.id).subscribe({
        next: () => {
          this.snackBar.open('Order cancelled', 'Close', { duration: 3000 });
          setTimeout(() => this.loadAll());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Failed to cancel order', 'Close', { duration: 4000 }),
      });
    });
  }
}
