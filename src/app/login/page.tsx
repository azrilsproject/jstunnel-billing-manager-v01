'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(ellipse at 50% -20%, #1e3a8a 0%, #0b0f19 70%)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 16px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 800,
              color: '#fff',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
            }}
          >
            J
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            JAMES BILLING
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Billing Management & Isolir Otomatis PPPoE MikroTik
          </p>
        </div>

        {state.message && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            <span>⚠️</span>
            <span>{state.message}</span>
          </div>
        )}

        <form action={formAction}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username Admin
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              defaultValue="admin"
              placeholder="Masukkan username"
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              defaultValue="admin123"
              placeholder="Masukkan password"
              className="form-input"
            />
          </div>

          <SubmitButton className="btn-primary" style={{ width: '100%', padding: '12px' }}>
            Masuk ke Sistem
          </SubmitButton>
        </form>

        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--text-dim)',
            textAlign: 'center',
          }}
        >
          Default Akun: <code style={{ color: '#93c5fd' }}>admin</code> /{' '}
          <code style={{ color: '#93c5fd' }}>admin123</code>
        </div>
      </div>
    </div>
  );
}
