import { Component, inject, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AuthService } from '../../core/services/auth.service';
import { QrService } from '../../core/services/qr.service';
import { DashboardService, LowStockProduct } from '../../core/services/dashboard.service';

// ── Mobile QR Dialog ─────────────────────────────────────────────────────────

@Component({
  selector: 'app-mobile-qr-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Mobile Access QR Code</h2>
    <mat-dialog-content class="qr-content">
      <img [src]="data.qrUrl" alt="Mobile QR Code" class="qr-image" />
      <p class="qr-hint">
        Print this QR code and place it at your counter.<br />
        Staff scan it with their phone to open StockPilot instantly.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-flat-button (click)="download()">
        <mat-icon>download</mat-icon>
        Download PNG
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .qr-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 24px 16px;
    }
    .qr-image {
      width: 260px;
      height: 260px;
      border: 2px solid #E2E8F0;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    }
    .qr-hint {
      margin-top: 18px;
      font-size: 13px;
      color: #64748B;
      text-align: center;
      line-height: 1.65;
      max-width: 280px;
    }
  `],
})
export class MobileQRDialogComponent {
  data = inject<{ qrUrl: string }>(MAT_DIALOG_DATA);

  download() {
    const a = document.createElement('a');
    a.href = this.data.qrUrl;
    a.download = 'stockpilot-mobile-qr.png';
    a.click();
  }
}

// ── Main Layout ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatListModule, MatIconModule,
    MatButtonModule, MatTooltipModule, MatDialogModule, MatBadgeModule,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent implements AfterViewInit {
  private authService        = inject(AuthService);
  private qrService          = inject(QrService);
  private dashboardService   = inject(DashboardService);
  private dialog             = inject(MatDialog);
  private snackBar           = inject(MatSnackBar);
  private cdr                = inject(ChangeDetectorRef);
  private breakpointObserver = inject(BreakpointObserver);

  @ViewChild(MatSidenav) private sidenav!: MatSidenav;

  currentUser       = this.authService.getCurrentUser();
  isEmployee        = this.authService.isEmployee();
  qrLoading         = false;
  showNotifications = false;
  lowStockProducts: LowStockProduct[] = [];

  // Initialised from window width so the template renders correctly before
  // ngAfterViewInit runs — prevents a visible flash on first load.
  isMobile      = typeof window !== 'undefined' && window.innerWidth <= 900;
  sidenavOpened = typeof window !== 'undefined' ? window.innerWidth > 900 : true;

  get lowStockCount(): number {
    return this.lowStockProducts.length;
  }

  constructor() {
    this.loadAlerts();
  }

  ngAfterViewInit(): void {
    // Subscribe here so @ViewChild(MatSidenav) is available.
    // Both the property and the imperative call are needed: the property keeps
    // the hamburger toggle and template bindings correct; the imperative call
    // forces the sidenav open/closed directly, which fixes the case where
    // closing DevTools widens the viewport back but the sidenav stays hidden
    // because mat-sidenav doesn't reliably honour [opened] changes when the
    // mode transitions (over→side) while the drawer is in a closed state.
    this.breakpointObserver.observe('(max-width: 900px)').subscribe(result => {
      this.isMobile      = result.matches;
      this.sidenavOpened = !result.matches;
      if (result.matches) {
        this.sidenav.close();
      } else {
        this.sidenav.open();
      }
    });
  }

  onNavClick(): void {
    if (this.isMobile) {
      this.sidenavOpened = false;
      this.sidenav.close();
    }
  }

  onBackdropClick(): void {
    if (this.isMobile) {
      this.sidenavOpened = false;
    }
  }

  private loadAlerts() {
    this.dashboardService.getLowStock().subscribe({
      next: (products) => {
        this.lowStockProducts = products;
        this.cdr.detectChanges();
      },
    });
  }

  logout() { this.authService.logout(); }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  closeNotifications() {
    this.showNotifications = false;
  }

  showMobileQR() {
    this.qrLoading = true;
    this.qrService.getMobileQR().subscribe({
      next: (blob) => {
        this.qrLoading = false;
        this.cdr.detectChanges();
        const qrUrl = URL.createObjectURL(blob);
        const ref = this.dialog.open(MobileQRDialogComponent, {
          data: { qrUrl },
          width: '360px',
        });
        ref.afterClosed().subscribe(() => URL.revokeObjectURL(qrUrl));
      },
      error: () => {
        this.qrLoading = false;
        this.cdr.detectChanges();
        this.snackBar.open(
          'Could not generate QR code. Make sure the backend server is running.',
          'Close',
          { duration: 5000 },
        );
      },
    });
  }
}
