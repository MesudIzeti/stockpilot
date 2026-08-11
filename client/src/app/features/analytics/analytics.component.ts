import { Component, inject, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { CURRENCIES, symbolFor } from '../../shared/currencies';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  AnalyticsService,
  RevenueTrendPoint,
  CategoryPerformance,
  TopProduct,
  SalesVelocity,
} from '../../core/services/analytics.service';

Chart.register(...registerables);

const CHART_COLORS = [
  '#4F46E5', '#059669', '#D97706', '#DC2626',
  '#7C3AED', '#0369A1', '#F59E0B', '#475569',
];

@Component({
  selector: 'app-analytics',
  imports: [
    CommonModule,
    MatCardModule, MatIconModule, MatButtonModule,
    MatTableModule, MatProgressSpinnerModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule,
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent implements OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('revenueChart')     private revenueChartRef!:     ElementRef<HTMLCanvasElement>;
  @ViewChild('topProductsChart') private topProductsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart')    private categoryChartRef!:    ElementRef<HTMLCanvasElement>;

  private revenueChartInst:     Chart | null = null;
  private topProductsChartInst: Chart | null = null;
  private categoryChartInst:    Chart | null = null;

  period  = 30;
  loading = true;

  trendData:    RevenueTrendPoint[]   = [];
  categoryData: CategoryPerformance[] = [];
  topProducts:  TopProduct[]          = [];
  velocityData: SalesVelocity[]       = [];

  velocityColumns = ['name', 'current_stock', 'units_per_day', 'days_until_stockout'];

  // ── Currency conversion ───────────────────────────────────────────────────
  readonly currencies = CURRENCIES;

  selectedCurrency  = 'USD';
  exchangeRate      = 1.0;
  private allRates: Record<string, number> = {};

  get currencySymbol(): string {
    return symbolFor(this.selectedCurrency);
  }

  // ── Computed KPIs ────────────────────────────────────────────────────────
  get totalRevenue(): number {
    return this.trendData.reduce((s, d) => s + Number(d.revenue), 0);
  }
  get totalProfit(): number {
    return this.trendData.reduce((s, d) => s + Number(d.profit), 0);
  }
  get totalTransactions(): number {
    return this.trendData.reduce((s, d) => s + Number(d.sales_count), 0);
  }
  get avgMargin(): number {
    return this.totalRevenue === 0 ? 0 : (this.totalProfit / this.totalRevenue) * 100;
  }

  constructor() {
    this.loadRates();
    this.loadData();
  }

  // ── Exchange rate loading ─────────────────────────────────────────────────
  private loadRates() {
    this.analyticsService.getExchangeRates().subscribe({
      next: (res) => { this.allRates = res.rates; },
      error: () => { /* fail silently — stays on USD with rate 1.0 */ },
    });
  }

  onCurrencyChange(code: string) {
    this.selectedCurrency = code;
    this.exchangeRate     = code === 'USD' ? 1.0 : (this.allRates[code] ?? 1.0);
    this.destroyCharts();
    setTimeout(() => this.drawCharts(), 0);
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  loadData() {
    this.loading = true;
    forkJoin({
      trend:    this.analyticsService.getRevenueTrend(this.period),
      category: this.analyticsService.getCategoryPerformance(this.period),
      top:      this.analyticsService.getTopProducts(this.period),
      velocity: this.analyticsService.getSalesVelocity(this.period),
    }).subscribe({
      next: (data) => {
        this.trendData    = data.trend;
        this.categoryData = data.category;
        this.topProducts  = data.top;
        this.velocityData = data.velocity;
        this.loading      = false;
        this.cdr.detectChanges();
        setTimeout(() => this.drawCharts(), 0);
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  setPeriod(days: number) {
    if (this.period === days) return;
    this.period = days;
    this.destroyCharts();
    this.loadData();
  }

  // ── Chart drawing ─────────────────────────────────────────────────────────
  private drawCharts() {
    this.drawRevenueChart();
    this.drawTopProductsChart();
    this.drawCategoryChart();
  }

  private drawRevenueChart() {
    if (!this.revenueChartRef?.nativeElement) return;
    if (this.revenueChartInst) { this.revenueChartInst.destroy(); }

    const ctx = this.revenueChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const sym  = this.currencySymbol;
    const rate = this.exchangeRate;
    const labels = this.trendData.map(d =>
      new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    );

    this.revenueChartInst = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: this.trendData.map(d => Number(d.revenue) * rate),
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79,70,229,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: this.trendData.length > 20 ? 2 : 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Profit',
            data: this.trendData.map(d => Number(d.profit) * rate),
            borderColor: '#059669',
            backgroundColor: 'rgba(5,150,105,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: this.trendData.length > 20 ? 2 : 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${sym}${Number(ctx.raw).toFixed(2)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `${sym}${v}` },
          },
        },
      },
    });
  }

  private drawTopProductsChart() {
    if (!this.topProductsChartRef?.nativeElement) return;
    if (this.topProductsChartInst) { this.topProductsChartInst.destroy(); }

    const ctx = this.topProductsChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const sym  = this.currencySymbol;
    const rate = this.exchangeRate;
    const data = this.topProducts.slice(0, 8);
    const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s;

    this.topProductsChartInst = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(p => truncate(p.name, 22)),
        datasets: [{
          label: 'Units Sold',
          data: data.map(p => Number(p.total_units_sold)),
          backgroundColor: CHART_COLORS[0],
          borderRadius: 5,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                ` ${ctx.raw} units  ·  ${sym}${(Number(data[ctx.dataIndex].total_revenue) * rate).toFixed(2)} revenue`,
            },
          },
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false } },
        },
      },
    });
  }

  private drawCategoryChart() {
    if (!this.categoryChartRef?.nativeElement) return;
    if (this.categoryChartInst) { this.categoryChartInst.destroy(); }

    const ctx = this.categoryChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const sym  = this.currencySymbol;
    const rate = this.exchangeRate;
    const data = this.categoryData.slice(0, 8);
    const convertedValues = data.map(c => Number(c.revenue) * rate);
    const total = convertedValues.reduce((s, v) => s + v, 0);

    this.categoryChartInst = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(c => c.category_name),
        datasets: [{
          data: convertedValues,
          backgroundColor: CHART_COLORS.slice(0, data.length),
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = total > 0 ? ((Number(ctx.raw) / total) * 100).toFixed(1) : '0';
                return ` ${sym}${Number(ctx.raw).toFixed(2)} · ${pct}%`;
              },
            },
          },
        },
      },
    });
  }

  private destroyCharts() {
    this.revenueChartInst?.destroy();
    this.topProductsChartInst?.destroy();
    this.categoryChartInst?.destroy();
    this.revenueChartInst     = null;
    this.topProductsChartInst = null;
    this.categoryChartInst    = null;
  }

  ngOnDestroy() {
    this.destroyCharts();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  stockoutClass(days: number | null): string {
    if (days === null) return 'badge-neutral';
    if (days <= 7)  return 'badge-critical';
    if (days <= 14) return 'badge-warning';
    return 'badge-safe';
  }

  stockoutLabel(days: number | null): string {
    if (days === null) return 'No sales';
    if (days === 0)    return 'Today';
    return `${days}d`;
  }
}
