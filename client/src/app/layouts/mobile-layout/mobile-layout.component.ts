import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-mobile-layout',
  imports: [RouterOutlet, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="mobile-shell">
      <header class="mobile-header">
        <div class="mobile-brand">
          <mat-icon>inventory_2</mat-icon>
          <span>StockPilot</span>
        </div>
        <button mat-icon-button (click)="logout()" matTooltip="Logout">
          <mat-icon>logout</mat-icon>
        </button>
      </header>
      <main class="mobile-body">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .mobile-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: var(--mat-sys-surface-container-lowest);
    }
    .mobile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      height: 56px;
      background-color: var(--mat-sys-surface);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .mobile-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 700;
      color: var(--mat-sys-primary);
    }
    .mobile-body {
      flex: 1;
      padding: 16px;
    }
  `],
})
export class MobileLayoutComponent {
  private authService = inject(AuthService);
  logout() { this.authService.logout(); }
}
