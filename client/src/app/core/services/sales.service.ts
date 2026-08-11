import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface SaleItem {
  product_id: number;
  quantity: number;
  unit_price?: number;
}

export interface Sale {
  id: number;
  total_amount: number;
  usd_total: number;
  sale_currency: string | null;
  notes: string | null;
  created_at: string;
  item_count: number;
  product_names: string | null;
  category_names: string | null;
  performed_by: string | null;
  has_return: boolean;
  all_returned: boolean;
  return_number: number | null;
}

export interface SaleDetail extends Sale {
  items: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getSales() {
    return this.http.get<Sale[]>(`${this.api}/sales`);
  }

  createSale(items: SaleItem[], notes?: string) {
    return this.http.post<SaleDetail>(`${this.api}/sales`, { items, notes });
  }
}
