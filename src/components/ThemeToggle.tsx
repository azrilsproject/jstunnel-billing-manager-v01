'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle({ className = '', variant = 'sidebar' }: { className?: string; variant?: 'sidebar' | 'compact' }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'dark'; // default dark
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className={`btn btn-secondary ${className}`}
        style={{ opacity: 0.5 }}
        title="Ganti Tema Tampilan"
        aria-label="Ganti Tema Tampilan"
      >
        <span>🌓</span>
        {variant === 'sidebar' && <span>Tema</span>}
      </button>
    );
  }

  const isLight = theme === 'light';

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`btn btn-secondary ${className}`}
        style={{
          width: '36px',
          height: '36px',
          padding: 0,
          borderRadius: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
        }}
        title={isLight ? 'Beralih ke Mode Gelap (Dark Mode)' : 'Beralih ke Mode Terang (Light Mode)'}
        aria-label="Toggle Theme"
      >
        {isLight ? '🌙' : '☀️'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      title={isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
    >
      <span className="theme-toggle-icon">{isLight ? '🌙' : '☀️'}</span>
      <span className="theme-toggle-text">
        {isLight ? 'Mode Terang' : 'Mode Gelap'}
      </span>
      <span className="theme-toggle-pill">
        {isLight ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
