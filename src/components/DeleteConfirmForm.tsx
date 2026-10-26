'use client';

import React from 'react';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function DeleteConfirmForm({
  action,
  confirmMessage,
  children,
  className,
  style,
}: Props) {
  return (
    <form
      action={action}
      className={className}
      style={style}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
