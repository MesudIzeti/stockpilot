import {
  Component, inject, ChangeDetectorRef,
  ViewChildren, QueryList, ElementRef, OnDestroy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCardModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnDestroy {
  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private router      = inject(Router);
  private cdr         = inject(ChangeDetectorRef);

  constructor() {
    if (this.authService.isLoggedIn()) this.router.navigate(['/dashboard']);
  }

  // ── Step 1: registration form ────────────────────────────────────────────
  form = this.fb.group({
    name:     ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading     = false;
  error       = '';
  hidePassword = true;

  // ── Step 2: OTP verification ─────────────────────────────────────────────
  step: 'form' | 'otp' = 'form';
  pendingEmail  = '';
  otpDigits     = ['', '', '', '', '', ''];
  readonly otpIndices = [0, 1, 2, 3, 4, 5];
  otpLoading    = false;
  resendLoading = false;
  resendCooldown = 0;
  private resendTimer?: ReturnType<typeof setInterval>;

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  get otpCode(): string     { return this.otpDigits.join(''); }
  get otpComplete(): boolean { return this.otpDigits.every(d => d !== ''); }

  // ── Form submission → send OTP ───────────────────────────────────────────
  onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error   = '';

    const { name, email, password } = this.form.value;
    this.authService.register(name!, email!, password!).subscribe({
      next: (res) => {
        this.pendingEmail = res.email;
        this.step         = 'otp';
        this.loading      = false;
        this.startResendCooldown();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error   = err.error?.message || 'Registration failed. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── OTP digit box handlers ───────────────────────────────────────────────
  onOtpKeydown(event: KeyboardEvent, index: number) {
    const key = event.key;
    // If a digit is pressed while the box already has content, clear it first
    if (/^\d$/.test(key) && this.otpDigits[index]) {
      this.otpDigits[index] = '';
      (event.target as HTMLInputElement).value = '';
    }
    if (key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      this.otpInputs.toArray()[index - 1]?.nativeElement.focus();
    }
  }

  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val   = input.value.replace(/\D/g, '');
    this.otpDigits[index] = val ? val[0] : '';
    input.value           = this.otpDigits[index];
    if (this.otpDigits[index] && index < 5) {
      this.otpInputs.toArray()[index + 1]?.nativeElement.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const digits = (event.clipboardData?.getData('text') ?? '')
      .replace(/\D/g, '').slice(0, 6).split('');
    digits.forEach((d, i) => { this.otpDigits[i] = d; });
    const inputs = this.otpInputs.toArray();
    inputs.forEach((inp, i) => { inp.nativeElement.value = this.otpDigits[i] ?? ''; });
    inputs[Math.min(digits.length, 5)]?.nativeElement.focus();
  }

  // ── OTP submission → verify + create account ─────────────────────────────
  submitOtp() {
    if (!this.otpComplete || this.otpLoading) return;
    this.otpLoading = true;
    this.error      = '';

    this.authService.verifyEmail(this.pendingEmail, this.otpCode).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error      = err.error?.message || 'Verification failed. Please try again.';
        this.otpLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Resend code ──────────────────────────────────────────────────────────
  resendCode() {
    if (this.resendCooldown > 0 || this.resendLoading) return;
    this.resendLoading = true;
    this.error         = '';

    const { name, email, password } = this.form.value;
    this.authService.register(name!, email!, password!).subscribe({
      next: () => {
        this.resendLoading = false;
        this.otpDigits     = ['', '', '', '', '', ''];
        this.otpInputs.toArray().forEach(inp => { inp.nativeElement.value = ''; });
        this.otpInputs.toArray()[0]?.nativeElement.focus();
        this.startResendCooldown();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error         = err.error?.message || 'Failed to resend code.';
        this.resendLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private startResendCooldown() {
    this.resendCooldown = 60;
    clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) clearInterval(this.resendTimer);
      this.cdr.detectChanges();
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.resendTimer);
  }
}
