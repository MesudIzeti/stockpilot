import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TeamService, Employee } from '../../core/services/team.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

// ── Add Employee Dialog ───────────────────────────────────────────────────────

@Component({
  selector: 'app-add-employee-dialog',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Add Employee</h2>
    <mat-dialog-content>
      <p style="margin:0 0 16px;font-size:13px;color:var(--mat-sys-on-surface-variant)">
        The employee will be able to log in, manage products, and process sales —
        but cannot view analytics or manage team members.
      </p>
      @if (errorMsg) {
        <div class="error-banner">
          <mat-icon>error_outline</mat-icon>
          {{ errorMsg }}
        </div>
      }
      <form [formGroup]="form" style="display:flex;flex-direction:column;gap:4px">
        <mat-form-field appearance="outline">
          <mat-label>Full Name</mat-label>
          <input matInput formControlName="name" placeholder="Full Name" />
          <mat-error>Name is required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" placeholder="ahmed@example.com" />
          <mat-error>Valid email is required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput formControlName="password" [type]="showPassword ? 'text' : 'password'" />
          <button mat-icon-button matSuffix type="button" (click)="showPassword = !showPassword">
            <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-hint>Minimum 6 characters</mat-hint>
          <mat-error>Password must be at least 6 characters</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [disabled]="form.invalid || saving" (click)="submit()">
        {{ saving ? 'Creating…' : 'Create Account' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #FEE2E2;
      color: #7F1D1D;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 12px;
      border-left: 3px solid #DC2626;
    }
    .error-banner mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
  `],
})
export class AddEmployeeDialogComponent {
  private fb = inject(FormBuilder);
  private teamService = inject(TeamService);
  private dialogRef = inject(MatDialogRef<AddEmployeeDialogComponent>);

  showPassword = false;
  saving = false;
  errorMsg = '';

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit() {
    if (this.form.invalid) return;
    this.saving = true;
    this.errorMsg = '';
    const { name, email, password } = this.form.value;
    this.teamService.createEmployee(name!, email!, password!).subscribe({
      next: (res) => this.dialogRef.close(res.employee),
      error: (err) => {
        this.saving = false;
        this.errorMsg = err.error?.message || 'Failed to create employee';
      },
    });
  }
}

// ── Team Page ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-team',
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule, MatDialogModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Team Management</h1>
          <p class="page-subtitle">Manage employee accounts for your business</p>
        </div>
        <button mat-flat-button (click)="openAddDialog()">
          <mat-icon>person_add</mat-icon>
          Add Employee
        </button>
      </div>

      <div class="owner-card">
        <div class="owner-avatar">{{ ownerInitial }}</div>
        <div>
          <div class="owner-name">{{ currentUser?.name }}</div>
          <div class="owner-meta">{{ currentUser?.email }} · Business Owner</div>
        </div>
        <span class="badge-owner">Owner</span>
      </div>

      @if (loading) {
        <div class="empty-state">
          <mat-icon>hourglass_empty</mat-icon>
          <p>Loading employees…</p>
        </div>
      } @else if (employees.length === 0) {
        <div class="empty-state">
          <mat-icon>group_add</mat-icon>
          <p>No employees yet</p>
          <span>Add your first team member to get started</span>
        </div>
      } @else {
        <div class="employee-list">
          @for (emp of employees; track emp.id) {
            <div class="employee-card" (click)="viewActivity(emp)" role="button" tabindex="0"
                 (keydown.enter)="viewActivity(emp)">
              <div class="emp-avatar">{{ emp.name[0].toUpperCase() }}</div>
              <div class="emp-info">
                <div class="emp-name">{{ emp.name }}</div>
                <div class="emp-email">{{ emp.email }}</div>
              </div>
              <span class="badge-employee">Employee</span>
              <div class="emp-date">Joined {{ emp.created_at | date:'mediumDate' }}</div>
              <button mat-icon-button matTooltip="View activity log" (click)="viewActivity(emp); $event.stopPropagation()">
                <mat-icon>open_in_new</mat-icon>
              </button>
              <button mat-icon-button color="warn"
                      matTooltip="Remove employee"
                      (click)="deleteEmployee(emp); $event.stopPropagation()">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { padding: 0; }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 28px;
      gap: 16px;
    }
    .page-title { margin: 0; font-size: 26px; font-weight: 800; color: #0F172A; letter-spacing: -0.4px; }
    .page-subtitle { margin: 4px 0 0; font-size: 13px; color: #64748B; }

    .owner-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(15,23,42,0.06);
    }
    .owner-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
      color: #ffffff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 16px; flex-shrink: 0;
    }
    .owner-name { font-weight: 700; font-size: 14px; color: #0F172A; }
    .owner-meta { font-size: 12px; color: #64748B; margin-top: 2px; }

    .badge-owner {
      margin-left: auto;
      background: #D1FAE5; color: #065F46;
      padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;
    }
    .badge-employee {
      background: #EEF2FF; color: #3730A3;
      padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;
    }

    .employee-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }

    .employee-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 20px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-shadow: 0 1px 3px rgba(15,23,42,0.04);
    }
    .employee-card:hover {
      border-color: #CBD5E1;
      box-shadow: 0 2px 6px rgba(15,23,42,0.08);
    }
    .emp-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: #EEF2FF;
      color: #4F46E5;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 15px; flex-shrink: 0;
    }
    .emp-info { flex: 1; min-width: 0; }
    .emp-name { font-weight: 700; font-size: 14px; color: #0F172A; }
    .emp-email { font-size: 12px; color: #64748B; margin-top: 2px; }
    .emp-date { font-size: 12px; color: #94A3B8; white-space: nowrap; }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
      color: #94A3B8;
    }
    .empty-state mat-icon { font-size: 48px; height: 48px; width: 48px; opacity: 0.25; }
    .empty-state p { margin: 12px 0 4px; font-size: 16px; font-weight: 600; color: #64748B; }
    .empty-state span { font-size: 13px; }
  `],
})
export class TeamComponent {
  private teamService = inject(TeamService);
  private authService = inject(AuthService);
  private router      = inject(Router);
  private dialog      = inject(MatDialog);
  private snackBar    = inject(MatSnackBar);
  private cdr         = inject(ChangeDetectorRef);

  currentUser = this.authService.getCurrentUser();
  employees: Employee[] = [];
  loading = true;

  get ownerInitial(): string {
    return this.currentUser?.name?.[0]?.toUpperCase() ?? 'O';
  }

  constructor() {
    this.loadEmployees();
  }

  private loadEmployees() {
    this.teamService.getEmployees().subscribe({
      next: (list) => {
        this.employees = list;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  viewActivity(emp: Employee) {
    this.router.navigate(['/team', emp.id]);
  }

  openAddDialog() {
    const ref = this.dialog.open(AddEmployeeDialogComponent, { width: '440px' });
    ref.afterClosed().subscribe((employee: Employee | undefined) => {
      if (employee) {
        this.employees = [employee, ...this.employees];
        this.cdr.detectChanges();
        this.snackBar.open(`${employee.name}'s account created successfully`, 'OK', { duration: 3000 });
      }
    });
  }

  deleteEmployee(emp: Employee) {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Remove Employee',
        message: `${emp.name} will no longer be able to log in.`,
        confirmLabel: 'Remove',
        icon: 'person_remove',
      },
      width: '400px',
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.teamService.deleteEmployee(emp.id).subscribe({
        next: () => {
          this.employees = this.employees.filter(e => e.id !== emp.id);
          this.cdr.detectChanges();
          this.snackBar.open(`${emp.name} removed from team`, 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to remove employee', 'Close', { duration: 4000 });
        },
      });
    });
  }
}
