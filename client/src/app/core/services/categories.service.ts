import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Category {
  id: number;
  name: string;
  description: string | null;
  product_count: number;
}

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getAll() {
    return this.http.get<Category[]>(`${this.api}/categories`);
  }

  create(data: { name: string; description?: string }) {
    return this.http.post<Category>(`${this.api}/categories`, data);
  }

  update(id: number, data: { name: string; description?: string }) {
    return this.http.put<Category>(`${this.api}/categories/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/categories/${id}`);
  }

  getDeleted() {
    return this.http.get<DeletedCategory[]>(`${this.api}/categories/deleted`);
  }

  restore(id: number) {
    return this.http.put<{ message: string }>(`${this.api}/categories/${id}/restore`, {});
  }
}

export interface DeletedCategory {
  id: number;
  name: string;
  description: string | null;
  deleted_at: string;
}
