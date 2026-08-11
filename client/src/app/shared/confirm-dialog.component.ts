import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: 'warn' | 'primary';
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="cd-header">
      <mat-icon class="cd-icon"
        [class.cd-icon--warn]="(data.confirmColor ?? 'warn') === 'warn'"
        [class.cd-icon--primary]="data.confirmColor === 'primary'">
        {{ data.icon ?? 'delete_outline' }}
      </mat-icon>
      <h2 mat-dialog-title>{{ data.title }}</h2>
    </div>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Cancel</button>
      <button mat-flat-button [color]="data.confirmColor ?? 'warn'" (click)="dialogRef.close(true)">
        {{ data.confirmLabel ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cd-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 24px 0;
    }
    .cd-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      flex-shrink: 0;
    }
    .cd-icon--warn    { color: #DC2626; }
    .cd-icon--primary { color: #4F46E5; }
    h2[mat-dialog-title] {
      margin: 0;
      padding: 0;
      font-size: 17px;
      font-weight: 700;
      color: #0F172A;
      letter-spacing: -0.1px;
    }
    mat-dialog-content {
      padding: 12px 24px 8px !important;
    }
    mat-dialog-content p {
      margin: 0;
      font-size: 14px;
      color: #64748B;
      line-height: 1.6;
      max-width: 360px;
    }
    mat-dialog-actions {
      padding: 8px 16px 16px !important;
    }
  `],
})
export class ConfirmDialogComponent {
  data      = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
}
