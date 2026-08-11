import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Return {
  id: number;
  return_number: number;
  sale_id: number;
  reason: 'refund' | 'warranty' | 'exchange';
  notes: string | null;
  total_refund: number;
  created_at: string;
  performed_by: string | null;
  product_names: string | null;
}

export interface SaleReturnItem {
  id: number;
  quantity: number;         // original qty purchased
  unit_price: number;
  total_price: number;
  currency: string;
  exchange_rate: number;
  product_name: string;
  unit: string;
  is_returned: boolean;     // true when remaining_quantity === 0
  returned_quantity: number;
  remaining_quantity: number;
}

export interface SaleForReturn {
  sale: { id: number; total_amount: number; created_at: string };
  items: SaleReturnItem[];
  already_returned: boolean;
  return_number: number | null;
}

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private http = inject(HttpClient);
  private api  = environment.apiUrl;

  getReturns() {
    return this.http.get<Return[]>(`${this.api}/returns`);
  }

  getSaleForReturn(saleId: number) {
    return this.http.get<SaleForReturn>(`${this.api}/returns/sale/${saleId}`);
  }

  createReturn(saleId: number, reason: string, items: { sale_item_id: number; quantity: number }[], notes?: string) {
    return this.http.post<{ message: string; return: Return }>(`${this.api}/returns`, {
      sale_id: saleId,
      reason,
      items,
      notes:   notes || undefined,
    });
  }
}
