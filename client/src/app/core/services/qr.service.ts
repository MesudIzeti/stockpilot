import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QrService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getMobileQR() {
    const baseUrl = window.location.origin;
    return this.http.get(
      `${this.api}/qr/mobile?baseUrl=${encodeURIComponent(baseUrl)}`,
      { responseType: 'blob' },
    );
  }
}
