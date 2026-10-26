'use client';

import { useFormStatus } from 'react-dom';

type Props = {
  children: React.ReactNode;
  className?: string;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
  type?: 'submit' | 'button' | 'reset';
  onClick?: () => void;
};

export function SubmitButton({
  children,
  className = '',
  loadingText = 'Memproses...',
  variant = 'primary',
  size = 'md',
  style,
  type = 'submit',
  onClick,
}: Props) {
  const { pending } = useFormStatus();

  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    success: 'btn-success',
  }[variant];

  const sizeClass = size === 'sm' ? 'btn-sm' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      style={{
        ...style,
        opacity: pending ? 0.7 : 1,
        cursor: pending ? 'not-allowed' : 'pointer',
      }}
    >
      {pending && (
        <svg
          style={{
            animation: 'spin 1s linear infinite',
            width: '14px',
            height: '14px',
            marginRight: '6px',
          }}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            style={{ opacity: 0.25 }}
          />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {pending ? loadingText : children}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}
