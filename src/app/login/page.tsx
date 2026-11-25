'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">J</div>
          <h1 className="auth-title">JAMES BILLING</h1>
          <p className="auth-sub">Billing & isolir otomatis PPPoE MikroTik</p>
        </div>

        {state.message && (
          <div className="alert alert-error" style={{ marginBottom: '18px' }}>
            <span>{state.message}</span>
          </div>
        )}

        <form action={formAction}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              defaultValue="admin"
              placeholder="Masukkan username"
              className="form-input"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              defaultValue="admin123"
              placeholder="Masukkan password"
              className="form-input"
              autoComplete="current-password"
            />
          </div>

          <SubmitButton className="btn-primary" style={{ width: '100%', padding: '11px' }} loadingText="Masuk...">
            Masuk
          </SubmitButton>
        </form>

        <p className="auth-hint">
          Akun awal: <code>admin</code> / <code>admin123</code> — segera ganti di Pengaturan.
        </p>
      </div>
    </div>
  );
}
