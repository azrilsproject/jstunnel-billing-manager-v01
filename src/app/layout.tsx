import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Billing Manager - PPPoE MikroTik',
  description: 'Aplikasi manajemen billing, invoice bulanan, dan isolir otomatis PPPoE MikroTik',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-main)' }} />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
