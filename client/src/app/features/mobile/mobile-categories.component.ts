import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CategoriesService, Category } from '../../core/services/categories.service';

@Component({
  selector: 'app-mobile-categories',
  imports: [FormsModule, MatCardModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 class="page-title">Categories</h2>

    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search categories</mat-label>
      <input matInput [(ngModel)]="search" placeholder="Search categories…" />
      <mat-icon matSuffix>search</mat-icon>
    </mat-form-field>

    @if (loading) {
      <div class="state-msg">Loading...</div>
    } @else if (filtered.length === 0) {
      <div class="state-msg">No categories found.</div>
    } @else {
      <div class="category-list">
        @for (cat of filtered; track cat.id) {
          <mat-card class="category-card" (click)="goToProducts(cat)">
            <mat-card-content>
              <div class="card-row">
                <div class="cat-info">
                  <mat-icon class="cat-icon">category</mat-icon>
                  <div class="cat-text">
                    <span class="cat-name">{{ cat.name }}</span>
                    @if (cat.description) {
                      <span class="cat-desc">{{ cat.description }}</span>
                    }
                  </div>
                </div>
                <div class="cat-right">
                  <span class="count-badge">{{ cat.product_count }}</span>
                  <mat-icon class="arrow-icon">chevron_right</mat-icon>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .page-title {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface);
    }
    .search-field {
      width: 100%;
      margin-bottom: 8px;
    }
    .state-msg {
      text-align: center;
      padding: 48px 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 15px;
    }
    .category-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .category-card {
      cursor: pointer;
      transition: box-shadow 0.15s;
      &:active { opacity: 0.8; }
    }
    .card-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cat-info {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }
    .cat-icon {
      color: var(--mat-sys-primary);
      font-size: 28px;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
    }
    .cat-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .cat-name {
      font-size: 17px;
      font-weight: 600;
      color: var(--mat-sys-on-surface);
    }
    .cat-desc {
      font-size: 13px;
      color: var(--mat-sys-on-surface-variant);
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cat-right {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .count-badge {
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
    }
    .arrow-icon {
      color: var(--mat-sys-on-surface-variant);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
  `],
})
export class MobileCategoriesComponent {
  private categoriesService = inject(CategoriesService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  categories: Category[] = [];
  loading = true;
  search = '';

  get filtered(): Category[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.categories;
    return this.categories.filter(c => c.name.toLowerCase().includes(q));
  }

  constructor() {
    this.categoriesService.getAll().subscribe({
      next: (cats) => {
        this.categories = cats;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  goToProducts(cat: Category) {
    this.router.navigate(['/mobile/categories', cat.id]);
  }
}
