'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { ThemeToggle } from '@/components/ThemeToggle';

type Props = {
  adminName: string;
  companyName: string;
};

export function Sidebar({ adminName, companyName }: Props) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/customers', label: 'Pelanggan PPPoE', icon: '👥' },
    { href: '/invoices', label: 'Invoice & Tagihan', icon: '🧾' },
    { href: '/reports', label: 'Laporan Keuangan', icon: '📈' },
    { href: '/packages', label: 'Paket Internet', icon: '⚡' },
    { href: '/logs', label: 'Log Aktivitas', icon: '📋' },
    { href: '/settings', label: 'Pengaturan & Router', icon: '⚙️' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-icon">J</div>
        <div>
          <div className="sidebar-brand-title">{companyName || 'JAMES BILLING'}</div>
          <div className="sidebar-brand-subtitle">PPPoE MikroTik Manager</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-category">Menu Utama</div>
        {navItems.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${active ? 'active' : ''}`}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="nav-category" style={{ marginTop: '16px' }}>
          Tautan Eksternal
        </div>
        <Link
          href="/isolir"
          target="_blank"
          className="nav-link"
          style={{ opacity: 0.8 }}
        >
          <span style={{ fontSize: '16px' }}>🛡️</span>
          <span>Halaman Isolir Web</span>
        </Link>
      </nav>

      <div style={{ padding: '0 16px 14px' }}>
        <ThemeToggle />
      </div>

      <div className="sidebar-footer">
        <div className="user-badge">
          <div className="user-avatar">{adminName.charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px',
              }}
            >
              {adminName}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Administrator</div>
          </div>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            title="Keluar / Logout"
            style={{ padding: '6px 10px' }}
          >
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
