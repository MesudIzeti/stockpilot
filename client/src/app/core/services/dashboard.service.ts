import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DashboardSummary {
  total_products: number;
  total_categories: number;
  today_sales_count: number;
  today_revenue: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  min_stock_level: number;
  category_name: string;
  supplier_name: string;
  supplier_phone: string;
  supplier_email: string;
}

export interface ExpiryProduct {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  expiry_date: string;
  category_name: string;
  days_until_expiry: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getSummary() {
    return this.http.get<DashboardSummary>(`${this.api}/dashboard/summary`);
  }

  getLowStock() {
    return this.http.get<LowStockProduct[]>(`${this.api}/dashboard/low-stock`);
  }

  getExpiryWarnings(days = 7) {
    return this.http.get<ExpiryProduct[]>(`${this.api}/dashboard/expiry-warnings?days=${days}`);
  }
}
