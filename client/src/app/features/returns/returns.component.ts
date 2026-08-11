import { Component, inject, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReturnsService, Return, SaleForReturn, SaleReturnItem } from '../../core/services/returns.service';

// ── Process Return Dialog ─────────────────────────────────────────────────────

@Component({
  selector: 'app-return-dialog',
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Process Return</h2>

    <mat-dialog-content>

      <!-- Phase 1: Look up the sale -->
      @if (phase === 1) {
        <p class="hint">Enter the Sale ID to load the transaction details.</p>
        <div class="search-row">
          <mat-form-field appearance="outline" class="sale-id-field">
            <mat-label>Sale ID</mat-label>
            <input matInput [(ngModel)]="saleIdInput" type="number" min="1"
                   (keyup.enter)="loadSale()" placeholder="e.g. 5" />
          </mat-form-field>
          <button mat-flat-button (click)="loadSale()"
                  [disabled]="!saleIdInput || loadingSale">
            @if (loadingSale) {
              <mat-spinner diameter="18" />
            } @else {
              Look Up
            }
          </button>
        </div>
        @if (saleError) {
          <p class="error-msg">{{ saleError }}</p>
        }
      }

      <!-- Phase 2: Confirm return details -->
      @if (phase === 2 && saleData) {
        @if (saleData.already_returned) {
          <div class="already-returned">
            <mat-icon>check_circle</mat-icon>
            <p>Sale #{{ saleIdInput }} has already been returned
              (Return #{{ saleData.return_number }}).</p>
          </div>
        } @else {
          <div class="sale-summary">
            <span>Sale #{{ saleIdInput }}</span>
            <span>{{ saleData.sale.created_at | date:'mediumDate' }}</span>
            <span class="sale-total">\${{ saleData.sale.total_amount | number:'1.2-2' }}</span>
          </div>

          <p class="section-label">Select items to return</p>
          <div class="items-list">
            @for (item of saleData.items; track item.id) {
              <div class="item-row">
                <mat-checkbox
                  [checked]="selectedItemIds.has(item.id)"
                  (change)="toggleItem(item.id)">
                  <div class="item-info">
                    <span class="item-name">{{ item.product_name }}</span>
                    <span class="item-detail">
                      {{ item.quantity }} {{ item.unit }} &times;
                      \${{ item.unit_price | number:'1.2-2' }} =
                      \${{ item.total_price | number:'1.2-2' }}
                    </span>
                  </div>
                </mat-checkbox>
              </div>
            }
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason *</mat-label>
            <mat-select [(ngModel)]="reason">
              <mat-option value="refund">Refund</mat-option>
              <mat-option value="warranty">Warranty</mat-option>
              <mat-option value="exchange">Exchange</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Notes (optional)</mat-label>
            <textarea matInput [(ngModel)]="notes" rows="2"></textarea>
          </mat-form-field>

          <div class="refund-row">
            <span>Refund Total</span>
            <strong class="refund-amount">\${{ totalRefund | number:'1.2-2' }}</strong>
          </div>
        }
      }

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (phase === 1) {
        <button mat-button mat-dialog-close>Cancel</button>
      } @else {
        <button mat-button (click)="phase = 1">Back</button>
        @if (saleData?.already_returned) {
          <button mat-button mat-dialog-close>Close</button>
        } @else {
          <button mat-flat-button (click)="confirm()" [disabled]="!canSubmit">
            Confirm Return
          </button>
        }
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .hint { margin: 0 0 16px; color: var(--mat-sys-on-surface-variant); font-size: 14px; }
    .search-row {
      display: flex; gap: 12px; align-items: center;
    }
    .sale-id-field { flex: 1; }
    .error-msg { color: var(--mat-sys-error); font-size: 13px; margin: 8px 0 0; }
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
    .items-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
    .item-row {
      padding: 10px 14px; border-radius: 10px;
      border: 1px solid #E2E8F0; background: #FFFFFF;
    }
    .item-info { display: flex; flex-direction: column; gap: 2px; }
    .item-name { font-size: 14px; font-weight: 600; color: #0F172A; }
    .item-detail { font-size: 12px; color: #64748B; }
    .full-width { width: 100%; }
    .refund-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 4px; margin-top: 8px;
      border-top: 2px solid #E2E8F0;
      font-size: 15px; font-weight: 600; color: #64748B;
    }
    .refund-amount { font-size: 20px; color: #059669; font-weight: 800; font-variant-numeric: tabular-nums; }
    mat-dialog-content { min-width: 500px; max-height: 75vh; padding-top: 8px !important; }
  `],
})
export class ReturnDialogComponent {
  private svc       = inject(ReturnsService);
  private cdr       = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<ReturnDialogComponent>);

  phase: 1 | 2      = 1;
  saleIdInput: number | null = null;
  loadingSale        = false;
  saleError          = '';
  saleData: SaleForReturn | null = null;
  selectedItemIds    = new Set<number>();
  reason             = '';
  notes              = '';

  loadSale() {
    if (!this.saleIdInput) return;
    this.loadingSale = true;
    this.saleError   = '';
    this.svc.getSaleForReturn(this.saleIdInput).subscribe({
      next: (data) => {
        this.saleData    = data;
        this.loadingSale = false;
        this.phase       = 2;
        if (!data.already_returned) {
          data.items.forEach(item => this.selectedItemIds.add(item.id));
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saleError   = err.error?.message || 'Sale not found';
        this.loadingSale = false;
        this.cdr.detectChanges();
      },
    });
  }

  toggleItem(id: number) {
    if (this.selectedItemIds.has(id)) this.selectedItemIds.delete(id);
    else this.selectedItemIds.add(id);
  }

  get totalRefund(): number {
    if (!this.saleData) return 0;
    return this.saleData.items
      .filter(i => this.selectedItemIds.has(i.id))
      .reduce((sum, i) => sum + Number(i.total_price), 0);
  }

  get canSubmit(): boolean {
    return this.selectedItemIds.size > 0 && !!this.reason;
  }

  confirm() {
    if (!this.canSubmit || !this.saleIdInput || !this.saleData) return;
    // Build the items array the API expects: { sale_item_id, quantity }
    // Use remaining_quantity so we never accidentally exceed what's returnable.
    const items = this.saleData.items
      .filter(i => this.selectedItemIds.has(i.id) && !i.is_returned)
      .map(i => ({ sale_item_id: i.id, quantity: i.remaining_quantity }));
    this.dialogRef.close({
      saleId: this.saleIdInput,
      reason: this.reason,
      items,
      notes:  this.notes,
    });
  }
}

// ── Returns Page ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-returns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatCardModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatTooltipModule, MatDialogModule,
  ],
  templateUrl: './returns.component.html',
  styleUrl:    './returns.component.scss',
})
export class ReturnsComponent implements OnInit {
  private svc      = inject(ReturnsService);
  private dialog   = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private cdr      = inject(ChangeDetectorRef);

  returns: Return[] = [];
  loading = true;
  columns = ['return_number', 'sale_id', 'product_names', 'reason', 'total_refund', 'performed_by', 'created_at'];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.getReturns().subscribe({
      next:  (data) => { this.returns = data; this.loading = false; this.cdr.markForCheck(); },
      error: ()     => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openReturnDialog() {
    const ref = this.dialog.open(ReturnDialogComponent, { width: '560px', disableClose: true });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.svc.createReturn(result.saleId, result.reason, result.items, result.notes).subscribe({
        next: (res) => {
          const refund = Number(res.return.total_refund).toFixed(2);
          this.snackBar.open(
            `Return #${res.return.return_number} processed — $${refund} refunded`,
            'Close', { duration: 4000 }
          );
          setTimeout(() => this.load());
        },
        error: (err) => this.snackBar.open(
          err.error?.message || 'Failed to process return', 'Close', { duration: 4000 }
        ),
      });
    });
  }

  reasonLabel(reason: string): string {
    return reason.charAt(0).toUpperCase() + reason.slice(1);
  }
}
