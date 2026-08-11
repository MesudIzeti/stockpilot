import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface ActivitySummary {
  sales_count: number;
  total_revenue: number;
  returns_count: number;
  total_refunded: number;
  products_added: number;
  stock_adjustments: number;
}

export interface Activity {
  activity_type: 'sale' | 'return' | 'product_added' | 'stock_adjustment';
  id: number;
  activity_date: string;
  amount: number | null;
  refund_amount: number | null;
  product_context: string | null;
  item_count: number | null;
  reason: string | null;
  qty: number | null;
  movement_type: string | null;
}

export interface EmployeeActivityResponse {
  employee: { id: number; name: string; email: string; created_at: string };
  summary: ActivitySummary;
  activities: Activity[];
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/users`;

  getEmployees() {
    return this.http.get<Employee[]>(`${this.api}/employees`);
  }

  createEmployee(name: string, email: string, password: string) {
    return this.http.post<{ message: string; employee: Employee }>(
      `${this.api}/employees`,
      { name, email, password }
    );
  }

  deleteEmployee(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/employees/${id}`);
  }

  getEmployeeActivity(id: number, filters: { from?: string; to?: string; type?: string; search?: string } = {}) {
    let params = new HttpParams();
    if (filters.from)   params = params.set('from',   filters.from);
    if (filters.to)     params = params.set('to',     filters.to);
    if (filters.type && filters.type !== 'all') params = params.set('type', filters.type);
    if (filters.search) params = params.set('search', filters.search);
    return this.http.get<EmployeeActivityResponse>(`${this.api}/employees/${id}/activity`, { params });
  }
}
