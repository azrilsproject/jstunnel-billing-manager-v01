import Link from 'next/link';

/** Ikon garis sederhana (path SVG 24x24) */
export const ICONS = {
  users: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 20a8 8 0 0 1 16 0',
  shield: 'M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zm13 6h2',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  receipt: 'M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2zm2 5h6M9 12h6',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  router: 'M3 15h18v5H3v-5zm3 2.5h.01M10 17.5h.01M7 15l3-6m7 6-3-6m-2-5a4 4 0 0 1 6 0m-9-2.5a8 8 0 0 1 12 0',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  upload: 'M12 20V9m0 0-4 4m4-4 4 4M5 4h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.5-4.5',
  check: 'M5 12.5 10 17 19 7',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 8h.01M11 12h1v5h1m8-5a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zm9-13 4 4',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  list: 'M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7v-7z',
  calendar: 'M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function PageHeader({
  title,
  desc,
  back,
  actions,
  badge,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div style={{ minWidth: 0 }}>
        {back && (
          <Link href={back.href} className="back-link">
            ← {back.label}
          </Link>
        )}
        <div className="page-title-row">
          <h1 className="page-title">{title}</h1>
          {badge}
        </div>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}

type Tone = 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate';

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = 'blue',
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: IconName;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className={`tile-icon tone-${tone}`}>
        <Icon name={icon} size={20} />
      </div>
      <div className="tile-body">
        <div className="tile-label">{label}</div>
        <div className="tile-value">{value}</div>
        {sub && <div className="tile-sub">{sub}</div>}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="stat-tile is-link">
      {body}
    </Link>
  ) : (
    <div className="stat-tile">{body}</div>
  );
}

export function Panel({
  title,
  sub,
  action,
  children,
  flush,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** konten tanpa padding (mis. tabel) */
  flush?: boolean;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="panel-title">{title}</h2>
          {sub && <p className="panel-sub">{sub}</p>}
        </div>
        {action}
      </header>
      <div className={flush ? 'panel-body is-flush' : 'panel-body'}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-chip">
        <Icon name={icon} size={22} />
      </div>
      <div className="empty-state-title">{title}</div>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

const STATUS = {
  active: { label: 'Aktif', cls: 'badge-active' },
  isolated: { label: 'Terisolir', cls: 'badge-isolated' },
  inactive: { label: 'Berhenti', cls: 'badge-inactive' },
} as const;

export function StatusBadge({ status }: { status: 'active' | 'isolated' | 'inactive' }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s.cls}`}>
      <span className="badge-dot" />
      {s.label}
    </span>
  );
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar-sm">{(name.trim()[0] ?? '?').toUpperCase()}</span>;
}

/** Baris label : nilai untuk kartu detail */
export function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv-row">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{children}</span>
    </div>
  );
}
