import { Component, inject, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoriesService, Category } from '../../core/services/categories.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

// ── Dialog ────────────────────────────────────────────────────

@Component({
  selector: 'app-category-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.id ? 'Edit Category' : 'Add Category' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Electronics" />
          @if (form.get('name')?.invalid && form.get('name')?.touched) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description (optional)</mat-label>
          <textarea matInput formControlName="description" rows="3"
            placeholder="Brief description..."></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="form.invalid">
        {{ data.id ? 'Save Changes' : 'Add Category' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; padding-top: 8px; }
    .full-width { width: 100%; }
    mat-dialog-content { min-width: 400px; }
  `],
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
  ],
})
export class CategoryDialogComponent {
  private fb = inject(FormBuilder);
  data = inject<{ id?: number; name?: string; description?: string }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CategoryDialogComponent>);

  form = this.fb.group({
    name: [this.data.name ?? '', Validators.required],
    description: [this.data.description ?? ''],
  });

  save() {
    if (this.form.valid) this.dialogRef.close(this.form.value);
  }
}

// ── Page ──────────────────────────────────────────────────────

@Component({
  selector: 'app-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatCardModule, MatProgressSpinnerModule, MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit {
  private service = inject(CategoriesService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  categories: Category[] = [];
  loading = true;
  columns = ['name', 'description', 'product_count', 'actions'];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => {
        this.categories = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openDialog(category?: Category) {
    const ref = this.dialog.open(CategoryDialogComponent, { data: category ?? {} });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const call = category
        ? this.service.update(category.id, result)
        : this.service.create(result);
      call.subscribe({
        next: () => {
          this.snackBar.open(category ? 'Category updated' : 'Category added', 'Close', { duration: 3000 });
          setTimeout(() => this.load());
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Operation failed', 'Close', { duration: 4000 }),
      });
    });
  }

  delete(category: Category) {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Category',
        message: `"${category.name}" will be moved to trash for 30 days.`,
        confirmLabel: 'Delete',
      },
      width: '400px',
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.service.delete(category.id).subscribe({
        next: () => { this.snackBar.open('Category deleted', 'Close', { duration: 3000 }); setTimeout(() => this.load()); },
        error: (err) => this.snackBar.open(err.error?.message || 'Cannot delete category', 'Close', { duration: 4000 }),
      });
    });
  }
}
