import {
  Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TeamService, Activity, EmployeeActivityResponse } from '../../core/services/team.service';

const TYPE_FILTERS = [
  { value: 'all',              label: 'All Activity' },
  { value: 'sale',             label: 'Sales' },
  { value: 'return',           label: 'Returns' },
  { value: 'product_added',    label: 'Products Added' },
  { value: 'stock_adjustment', label: 'Stock Updates' },
] as const;

@Component({
  selector: 'app-employee-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrap">

      <!-- Header -->
      <div class="page-header">
        <button mat-icon-button class="back-btn" matTooltip="Back to Team" (click)="router.navigate(['/team'])">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-text">
          <h1 class="page-title">Activity Log</h1>
          @if (data) {
            <p class="page-sub">{{ data.employee.name }} · {{ data.employee.email }}</p>
          }
        </div>
      </div>

      <!-- Initial load spinner -->
      @if (loading && !data) {
        <div class="center-spinner"><mat-spinner diameter="48" /></div>
      } @else if (error) {
        <div class="error-msg">{{ error }}</div>
      } @else if (data) {

        <!-- Employee card -->
        <div class="emp-card">
          <div class="emp-avatar">{{ data.employee.name[0].toUpperCase() }}</div>
          <div class="emp-details">
            <div class="emp-name">{{ data.employee.name }}</div>
            <div class="emp-meta">{{ data.employee.email }}</div>
            <div class="emp-meta">Employee since {{ data.employee.created_at | date:'dd MMM yyyy' }}</div>
          </div>
          <span class="badge-employee">Employee</span>
        </div>

        <!-- Summary stats -->
        <div class="summary-grid">
          <div class="stat-card stat-blue">
            <div class="stat-value">{{ data.summary.sales_count }}</div>
            <div class="stat-label">Sales Processed</div>
          </div>
          <div class="stat-card stat-blue">
            <div class="stat-value">\${{ data.summary.total_revenue | number:'1.2-2' }}</div>
            <div class="stat-label">Revenue Generated</div>
          </div>
          <div class="stat-card stat-red">
            <div class="stat-value">{{ data.summary.returns_count }}</div>
            <div class="stat-label">Returns Handled</div>
          </div>
          <div class="stat-card stat-red">
            <div class="stat-value">\${{ data.summary.total_refunded | number:'1.2-2' }}</div>
            <div class="stat-label">Total Refunded</div>
          </div>
          <div class="stat-card stat-green">
            <div class="stat-value">{{ data.summary.products_added }}</div>
            <div class="stat-label">Products Added</div>
          </div>
          <div class="stat-card stat-purple">
            <div class="stat-value">{{ data.summary.stock_adjustments }}</div>
            <div class="stat-label">Stock Updates</div>
          </div>
        </div>

        <!-- Type filter tabs -->
        <div class="type-tabs">
          @for (tf of typeFilters; track tf.value) {
            <button class="type-tab"
                    [class.type-tab--active]="filterType === tf.value"
                    (click)="setType(tf.value)">
              {{ tf.label }}
            </button>
          }
        </div>

        <!-- Search + date filters -->
        <div class="filter-row">
          <mat-form-field appearance="outline" class="filter-field filter-search">
            <mat-label>Search by product</mat-label>
            <input matInput
                   [value]="filterSearch"
                   (input)="filterSearch = $any($event.target).value"
                   (keydown.enter)="load()"
                   placeholder="Product name…" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field filter-date">
            <mat-label>From</mat-label>
            <input matInput type="date"
                   [value]="filterFrom"
                   (change)="filterFrom = $any($event.target).value" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field filter-date">
            <mat-label>To</mat-label>
            <input matInput type="date"
                   [value]="filterTo"
                   (change)="filterTo = $any($event.target).value" />
          </mat-form-field>

          <button mat-flat-button (click)="load()" [disabled]="loading">Apply</button>

          @if (filterSearch || filterFrom || filterTo) {
            <button mat-stroked-button (click)="clearFilters()">Clear</button>
          }
        </div>

        <!-- Activity list -->
        @if (loading) {
          <div class="inline-spinner"><mat-spinner diameter="32" /></div>
        } @else if (data.activities.length === 0) {
          <div class="empty-state">
            <mat-icon>search_off</mat-icon>
            <p>No activity found.</p>
            @if (filterSearch || filterFrom || filterTo || filterType !== 'all') {
              <span>Try adjusting your filters.</span>
            } @else {
              <span>This employee hasn't processed any transactions yet.</span>
            }
          </div>
        } @else {
          <div class="activity-count">{{ data.activities.length }} result{{ data.activities.length !== 1 ? 's' : '' }}</div>
          <div class="activity-list">
            @for (a of data.activities; track a.activity_type + '-' + a.id) {
              <div class="activity-item">
                <div class="activity-icon" [style.background]="iconBg(a.activity_type)">
                  <mat-icon [style.color]="iconColor(a.activity_type)">{{ icon(a.activity_type) }}</mat-icon>
                </div>
                <div class="activity-body">
                  <div class="activity-title">{{ title(a) }}</div>
                  <div class="activity-detail">{{ detail(a) }}</div>
                </div>
                <div class="activity-date">{{ a.activity_date | date:'dd MMM yyyy' }}<br><span class="activity-time">{{ a.activity_date | date:'HH:mm' }}</span></div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page-wrap { padding: 0; }

    .page-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 28px;
    }
    .back-btn { flex-shrink: 0; }
    .page-title { margin: 0; font-size: 26px; font-weight: 800; color: #0F172A; letter-spacing: -0.4px; }
    .page-sub   { margin: 4px 0 0; font-size: 13px; color: #64748B; }

    .center-spinner { display: flex; justify-content: center; padding: 80px 0; }
    .error-msg { color: #DC2626; padding: 24px 0; font-size: 14px; }

    /* Employee card */
    .emp-card {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 20px; border-radius: 12px; margin-bottom: 24px;
      background: #FFFFFF; border: 1px solid #E2E8F0;
      box-shadow: 0 1px 3px rgba(15,23,42,0.06);
    }
    .emp-avatar {
      width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
      background: #EEF2FF; color: #4F46E5;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px;
    }
    .emp-details { flex: 1; }
    .emp-name { font-weight: 700; font-size: 15px; color: #0F172A; }
    .emp-meta { font-size: 12px; color: #64748B; margin-top: 2px; }
    .badge-employee {
      background: #EEF2FF; color: #3730A3;
      padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;
    }

    /* Summary stats */
    .summary-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px;
    }
    @media (max-width: 768px) {
      .summary-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .stat-card {
      padding: 14px 16px; border-radius: 10px; border-left: 3px solid;
      background: #FFFFFF; border-top: 1px solid #E2E8F0;
      border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0;
    }
    .stat-card.stat-blue   { border-left-color: #4F46E5; }
    .stat-card.stat-red    { border-left-color: #DC2626; }
    .stat-card.stat-green  { border-left-color: #059669; }
    .stat-card.stat-purple { border-left-color: #7C3AED; }
    .stat-value { font-size: 18px; font-weight: 800; color: #0F172A; font-variant-numeric: tabular-nums; }
    .stat-label { font-size: 11px; color: #94A3B8; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }

    /* Type tabs */
    .type-tabs {
      display: flex; gap: 4px; flex-wrap: wrap;
      margin-bottom: 12px;
      border-bottom: 2px solid #E2E8F0;
      padding-bottom: 0;
    }
    .type-tab {
      display: inline-flex; align-items: center;
      padding: 8px 14px; background: none; border: none;
      border-bottom: 2px solid transparent; margin-bottom: -2px;
      cursor: pointer; font-size: 13px; font-weight: 600;
      color: #94A3B8; border-radius: 6px 6px 0 0;
      transition: color 0.15s;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .type-tab:hover { background: #F1F5F9; color: #0F172A; }
    .type-tab--active { color: #4F46E5; border-bottom-color: #4F46E5; }

    /* Filter row */
    .filter-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .filter-field { margin-bottom: 0; }
    .filter-search { min-width: 240px; flex: 1; }
    .filter-date   { width: 160px; flex-shrink: 0; }

    .inline-spinner { display: flex; justify-content: center; padding: 32px 0; }

    /* Empty state */
    .empty-state {
      text-align: center; padding: 64px 24px; color: #94A3B8;
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.25; }
    .empty-state p    { margin: 12px 0 4px; font-size: 16px; font-weight: 600; color: #64748B; }
    .empty-state span { font-size: 13px; }

    .activity-count {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
      color: #94A3B8; margin-bottom: 10px;
    }

    /* Activity list */
    .activity-list { display: flex; flex-direction: column; gap: 6px; }

    .activity-item {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 12px 16px; border-radius: 10px;
      background: #FFFFFF; border: 1px solid #E2E8F0;
      transition: box-shadow 0.12s;
    }
    .activity-item:hover { box-shadow: 0 2px 6px rgba(15,23,42,0.08); }
    .activity-icon {
      width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .activity-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .activity-body { flex: 1; min-width: 0; }
    .activity-title  { font-size: 14px; font-weight: 600; color: #0F172A; }
    .activity-detail { font-size: 12px; color: #64748B; margin-top: 2px; }
    .activity-date   {
      font-size: 12px; color: #94A3B8;
      text-align: right; white-space: nowrap; flex-shrink: 0;
    }
    .activity-time   { font-size: 11px; opacity: 0.7; }
  `],
})
export class EmployeeActivityComponent implements OnInit {
  router      = inject(Router);
  private route       = inject(ActivatedRoute);
  private teamService = inject(TeamService);
  private cdr         = inject(ChangeDetectorRef);

  loading = true;
  data: EmployeeActivityResponse | null = null;
  error = '';
  employeeId = 0;

  filterType   = 'all';
  filterSearch = '';
  filterFrom   = '';
  filterTo     = '';

  readonly typeFilters = TYPE_FILTERS;

  ngOnInit() {
    this.employeeId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load() {
    this.loading = true;
    this.cdr.markForCheck();
    this.teamService.getEmployeeActivity(this.employeeId, {
      from:   this.filterFrom   || undefined,
      to:     this.filterTo     || undefined,
      type:   this.filterType   !== 'all' ? this.filterType : undefined,
      search: this.filterSearch || undefined,
    }).subscribe({
      next: (res) => {
        this.data    = res;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error   = err.error?.message || 'Failed to load activity.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  setType(type: string) {
    this.filterType = type;
    this.load();
  }

  clearFilters() {
    this.filterSearch = '';
    this.filterFrom   = '';
    this.filterTo     = '';
    this.load();
  }

  icon(type: string): string {
    switch (type) {
      case 'sale':             return 'point_of_sale';
      case 'return':           return 'assignment_return';
      case 'product_added':    return 'add_box';
      case 'stock_adjustment': return 'inventory_2';
      default:                 return 'circle';
    }
  }

  iconColor(type: string): string {
    switch (type) {
      case 'sale':             return '#4F46E5';
      case 'return':           return '#DC2626';
      case 'product_added':    return '#059669';
      case 'stock_adjustment': return '#7C3AED';
      default:                 return '#64748B';
    }
  }

  iconBg(type: string): string {
    switch (type) {
      case 'sale':             return '#EEF2FF';
      case 'return':           return '#FEE2E2';
      case 'product_added':    return '#D1FAE5';
      case 'stock_adjustment': return '#EDE9FE';
      default:                 return '#F1F5F9';
    }
  }

  title(a: Activity): string {
    switch (a.activity_type) {
      case 'sale':             return `Sale #${a.id}`;
      case 'return':           return `Return #${a.id}`;
      case 'product_added':    return `Added product: ${a.product_context}`;
      case 'stock_adjustment': return `Stock update — ${a.product_context}`;
      default:                 return 'Activity';
    }
  }

  detail(a: Activity): string {
    switch (a.activity_type) {
      case 'sale':
        return [
          a.item_count != null ? `${a.item_count} item(s)` : null,
          a.amount != null ? `$${Number(a.amount).toFixed(2)}` : null,
          a.product_context || null,
        ].filter(Boolean).join(' · ');
      case 'return':
        return [
          a.refund_amount != null ? `$${Number(a.refund_amount).toFixed(2)} refunded` : null,
          a.reason ? a.reason.charAt(0).toUpperCase() + a.reason.slice(1) : null,
          a.product_context || null,
        ].filter(Boolean).join(' · ');
      case 'product_added':
        return [
          a.amount != null ? `Price: $${Number(a.amount).toFixed(2)}` : null,
          a.qty != null ? `Initial stock: ${a.qty}` : null,
        ].filter(Boolean).join(' · ');
      case 'stock_adjustment':
        return [
          a.movement_type === 'IN' ? `+${a.qty} units (received)` : `±${a.qty} units`,
          a.reason || null,
        ].filter(Boolean).join(' · ');
      default:
        return '';
    }
  }
}
