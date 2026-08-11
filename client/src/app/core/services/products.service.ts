import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  cost_price: number | null;
  quantity: number;
  unit: string;
  currency: string;
  min_stock_level: number;
  expiry_date: string | null;
  category_id: number | null;
  category_name: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
}

export interface ProductPayload {
  name: string;
  sku?: string;
  description?: string;
  price: number;
  cost_price?: number;
  quantity: number;
  unit?: string;
  currency?: string;
  min_stock_level?: number;
  expiry_date?: string;
  category_id?: number;
  supplier_id?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getAll() {
    return this.http.get<Product[]>(`${this.api}/products`);
  }

  create(data: ProductPayload) {
    return this.http.post<Product>(`${this.api}/products`, data);
  }

  update(id: number, data: ProductPayload) {
    return this.http.put<Product>(`${this.api}/products/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/products/${id}`);
  }

  import(formData: FormData) {
    return this.http.post<{ imported: number; restocked: number; message: string }>(`${this.api}/products/import`, formData);
  }

  getOne(id: number) {
    return this.http.get<Product>(`${this.api}/products/${id}`);
  }

  getByCategory(categoryId: number) {
    return this.http.get<Product[]>(`${this.api}/products?category_id=${categoryId}`);
  }

  getDeleted() {
    return this.http.get<DeletedProduct[]>(`${this.api}/products/deleted`);
  }

  restore(id: number, stockCount: number) {
    return this.http.put<{ message: string }>(`${this.api}/products/${id}/restore`, { stock_count: stockCount });
  }
}

export interface DeletedProduct {
  id: number;
  name: string;
  sku: string | null;
  quantity: number;
  unit: string;
  price: number;
  deleted_at: string;
  category_name: string | null;
}
