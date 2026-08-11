import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface RevenueTrendPoint {
  date: string;
  sales_count: number;
  revenue: number;
  profit: number;
}

export interface CategoryPerformance {
  id: number;
  category_name: string;
  total_sales: number;
  total_units_sold: number;
  revenue: number;
  profit: number;
  margin_percent: number;
}

export interface TopProduct {
  id: number;
  name: string;
  unit: string;
  category_name: string;
  total_units_sold: number;
  total_revenue: number;
  total_profit: number;
  times_sold: number;
}

export interface SalesVelocity {
  id: number;
  name: string;
  current_stock: number;
  unit: string;
  min_stock_level: number;
  sold_in_period: number;
  units_per_day: number;
  days_until_stockout: number | null;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getRevenueTrend(days: number) {
    return this.http.get<RevenueTrendPoint[]>(`${this.api}/analytics/revenue-trend?days=${days}`);
  }

  getCategoryPerformance(days: number) {
    return this.http.get<CategoryPerformance[]>(`${this.api}/analytics/category-performance?days=${days}`);
  }

  getTopProducts(days: number, limit = 8) {
    return this.http.get<TopProduct[]>(`${this.api}/analytics/top-products?days=${days}&limit=${limit}`);
  }

  getSalesVelocity(days: number) {
    return this.http.get<SalesVelocity[]>(`${this.api}/analytics/sales-velocity?days=${days}`);
  }

  getExchangeRates() {
    return this.http.get<{ rates: Record<string, number>; base: string }>(
      `${this.api}/analytics/exchange-rates`
    );
  }
}
