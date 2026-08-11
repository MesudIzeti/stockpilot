import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface StockMovement {
  id: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  reason: string;
  reference_id: number | null;
  created_at: string;
  performed_by: string;
}

export interface ProductMovements {
  product: { id: number; name: string; quantity: number; unit: string };
  movements: StockMovement[];
}

export interface AdjustStockResponse {
  message: string;
  product_id: number;
  previous_quantity: number;
  new_quantity: number;
}

@Injectable({ providedIn: 'root' })
export class StockMovementService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getHistory(productId: number) {
    return this.http.get<ProductMovements>(`${this.api}/stock-movements/product/${productId}`);
  }

  adjustStock(productId: number, newQuantity: number, reason?: string) {
    return this.http.post<AdjustStockResponse>(`${this.api}/stock-movements/adjust`, {
      product_id: productId,
      new_quantity: newQuantity,
      reason,
    });
  }

  addStock(productId: number, quantity: number, reason?: string) {
    return this.http.post<AdjustStockResponse>(`${this.api}/stock-movements/add`, {
      product_id: productId,
      quantity,
      reason,
    });
  }
}
