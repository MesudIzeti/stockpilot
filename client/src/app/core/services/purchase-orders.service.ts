import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PurchaseOrderItem {
  id: number;
  product_id: number;
  product_name: string;
  unit: string;
  quantity_ordered: number;
  current_stock: number;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: 'in_transit' | 'received' | 'cancelled';
  notes: string | null;
  created_at: string;
  items: PurchaseOrderItem[];
}

export interface ReorderCandidate {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  min_stock_level: number;
  category_name: string;
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrdersService {
  private http = inject(HttpClient);
  private api  = environment.apiUrl;

  getOrders() {
    return this.http.get<PurchaseOrder[]>(`${this.api}/purchase-orders`);
  }

  getReorderCandidates(supplierId: number) {
    return this.http.get<ReorderCandidate[]>(
      `${this.api}/purchase-orders/reorder-candidates/${supplierId}`
    );
  }

  createOrder(
    supplierId: number,
    items: { product_id: number; quantity_ordered: number }[],
    notes?: string
  ) {
    return this.http.post<{ message: string; id: number }>(
      `${this.api}/purchase-orders`,
      { supplier_id: supplierId, items, notes }
    );
  }

  receiveOrder(id: number) {
    return this.http.put<{ message: string }>(`${this.api}/purchase-orders/${id}/receive`, {});
  }

  cancelOrder(id: number) {
    return this.http.put<{ message: string }>(`${this.api}/purchase-orders/${id}/cancel`, {});
  }
}
