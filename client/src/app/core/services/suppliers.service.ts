import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Supplier {
    id: number;
    name: string;
    email: string | null;
    phone: string| null;
    address: string | null;
    notes:string | null;
}

    @Injectable ({
        providedIn: 'root'
    })
    export class SuppliersService {
        private http = inject(HttpClient);
        private api = environment.apiUrl;

        getAll(){

            return this.http.get<Supplier[]>(`${this.api}/suppliers`);
        }
    create(data: { name: string; email?: string; phone?: string; address?: string; notes?: string }) {
    return this.http.post<Supplier>(`${this.api}/suppliers`, data);
  }

  update(id: number, data: { name: string; email?: string; phone?: string; address?: string; notes?: string }) {
    return this.http.put<Supplier>(`${this.api}/suppliers/${id}`, data);
  }
   
  delete (id:number){
    return this.http.delete<{message:string}>(`${this.api}/suppliers/${id}`);

  }

    }
