import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { queryOne } from '@/lib/db';
import { listRoutersWithStats, toSummary } from '@/lib/routers';
import { MikrotikScriptGenerator } from '@/components/MikrotikScriptGenerator';
import { RouterManager } from './RouterManager';
import { ImportPanel } from './ImportPanel';

type Props = {
  searchParams: Promise<{ router?: string; tab?: string }>;
};

const TABS = [
  { id: 'router', label: 'Daftar Router', icon: '📡' },
  { id: 'import', label: 'Impor PPPoE', icon: '📥' },
  { id: 'script', label: 'Script Isolir', icon: '🛡️' },
] as const;

export default async function RoutersPage({ searchParams }: Props) {
  await verifySession();
  const { router, tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.id === rawTab) ? (rawTab as (typeof TABS)[number]['id']) : 'router';

  const rows = await listRoutersWithStats();
  const routers = rows.map((r) => ({
    ...toSummary(r),
    customer_total: r.customer_total,
    customer_active: r.customer_active,
    customer_isolated: r.customer_isolated,
  }));
  const unassigned =
    (await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM customers WHERE router_id IS NULL'))?.n ?? 0;

  let selected: number | 'new' = 'new';
  if (router === 'new') selected = 'new';
  else if (router && routers.some((r) => r.id === Number(router))) selected = Number(router);
  else selected = routers.find((r) => r.is_default)?.id ?? routers[0]?.id ?? 'new';
  const selectedRouter = typeof selected === 'number' ? routers.find((r) => r.id === selected) ?? null : null;

  const online = routers.filter((r) => r.enabled).length;
  const totalCustomers = routers.reduce((n, r) => n + r.customer_total, 0);

  const tabHref = (id: string) => (id === 'router' ? '/routers' : `/routers?tab=${id}`) +
    (selectedRouter && id !== 'router' ? `&router=${selectedRouter.id}` : '');

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Router MikroTik</h1>
          <p className="page-desc">
            Hubungkan banyak router (NAS). Tiap pelanggan dipasangkan ke satu router, dan isolir otomatis
            dijalankan di router masing-masing.
          </p>
        </div>
      </div>

      {routers.length > 0 && (
        <div className="router-summary">
          <div className="router-summary-item">
            <span className="router-summary-value">{routers.length}</span>
            <span className="router-summary-label">Router terdaftar</span>
          </div>
          <div className="router-summary-item">
            <span className="router-summary-value" style={{ color: '#34d399' }}>{online}</span>
            <span className="router-summary-label">Aktif</span>
          </div>
          <div className="router-summary-item">
            <span className="router-summary-value">{totalCustomers}</span>
            <span className="router-summary-label">Pelanggan terpasang</span>
          </div>
          <div className="router-summary-item">
            <span className="router-summary-value" style={{ color: unassigned ? '#fbbf24' : undefined }}>{unassigned}</span>
            <span className="router-summary-label">Belum punya router</span>
          </div>
        </div>
      )}

      <div className="tab-bar" role="tablist">
        {TABS.map((t) => (
          <Link key={t.id} href={tabHref(t.id)} scroll={false} className={`tab-link ${tab === t.id ? 'is-active' : ''}`} role="tab" aria-selected={tab === t.id}>
            <span>{t.icon}</span> {t.label}
          </Link>
        ))}
      </div>

      {tab === 'router' && (
        <div className="card">
          {routers.length === 0 && (
            <div className="onboarding">
              <div className="onboarding-title">Mulai dengan menambahkan router pertama</div>
              <ol className="onboarding-steps">
                <li>Di MikroTik, aktifkan service <code>api</code> (IP → Services) dan buat user khusus billing.</li>
                <li>Isi form di bawah, lalu klik <strong>Uji Koneksi</strong> untuk memastikan terhubung.</li>
                <li>Klik <strong>Tambah Router</strong>. Setelah itu impor PPPoE yang sudah ada, atau buat pelanggan baru.</li>
              </ol>
            </div>
          )}
          <RouterManager routers={routers} selected={selected} unassigned={unassigned} />
        </div>
      )}

      {tab === 'import' && (
        <div className="card">
          <ImportPanel routers={routers} selectedId={selectedRouter?.id ?? null} />
        </div>
      )}

      {tab === 'script' && (
        <div className="card">
          <MikrotikScriptGenerator
            key={selectedRouter?.id ?? 'none'}
            defaultProfile={selectedRouter?.isolir_profile || 'ISOLIR'}
          />
        </div>
      )}
    </div>
  );
}
