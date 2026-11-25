'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { ThemeToggle } from '@/components/ThemeToggle';

type Props = {
  adminName: string;
  companyName: string;
};

function Icon({ d }: { d: string }) {
  return (
    <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Sidebar({ adminName, companyName }: Props) {
  const pathname = usePathname();

  const navItems: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: '/dashboard', label: 'Dashboard', icon: <Icon d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /> },
    { href: '/customers', label: 'Pelanggan', icon: <Icon d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 20a8 8 0 0 1 16 0" /> },
    { href: '/invoices', label: 'Tagihan', icon: <Icon d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2zm2 5h6M9 12h6" /> },
    { href: '/reports', label: 'Laporan', icon: <Icon d="M4 20V10m6 10V4m6 16v-7m4 7H2" /> },
    { href: '/packages', label: 'Paket', icon: <Icon d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /> },
    { href: '/routers', label: 'Router', icon: <Icon d="M3 15h18v5H3v-5zm3 2.5h.01M10 17.5h.01M7 15l3-6m7 6-3-6m-2-5a4 4 0 0 1 6 0m-9-2.5a8 8 0 0 1 12 0" /> },
    { href: '/logs', label: 'Log Aktivitas', icon: <Icon d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01" /> },
    { href: '/settings', label: 'Pengaturan', icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2.2-1.3L14.5 3h-4l-.3 2.5a7.6 7.6 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2.2 1.3l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z" /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-icon">J</div>
        <div>
          <div className="sidebar-brand-title">{companyName || 'JAMES BILLING'}</div>
          <div className="sidebar-brand-subtitle">Billing PPPoE</div>
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
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="nav-category" style={{ marginTop: '16px' }}>
          Lainnya
        </div>
        <Link
          href="/isolir"
          target="_blank"
          className="nav-link"
          style={{ opacity: 0.8 }}
        >
          <Icon d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3z" />
          <span>Halaman Isolir</span>
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
