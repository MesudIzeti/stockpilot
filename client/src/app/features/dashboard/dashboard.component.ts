import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  DashboardService,
  DashboardSummary,
  LowStockProduct,
  ExpiryProduct,
} from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    MatCardModule, MatIconModule, MatTableModule, MatProgressSpinnerModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private authService      = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  summary: DashboardSummary | null = null;
  lowStock: LowStockProduct[] = [];
  expiryWarnings: ExpiryProduct[] = [];
  loading = true;
  isOwner = this.authService.isOwner();

  lowStockColumns = ['name', 'quantity', 'min_stock_level', 'category', 'supplier'];
  expiryColumns = ['name', 'expiry_date', 'days_until_expiry', 'quantity'];

  ngOnInit() {
    forkJoin({
      summary: this.dashboardService.getSummary(),
      lowStock: this.dashboardService.getLowStock(),
      expiryWarnings: this.dashboardService.getExpiryWarnings(),
    }).subscribe({
      next: (data) => {
        this.summary = data.summary;
        this.lowStock = data.lowStock;
        this.expiryWarnings = data.expiryWarnings;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }
}
