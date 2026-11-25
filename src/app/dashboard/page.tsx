import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query, queryOne } from '@/lib/db';
import { formatDate, formatDateTime, periodLabel, todayStr } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { listRoutersWithStats } from '@/lib/routers';
import { triggerBillingCycle, triggerGenerateInvoices } from '@/app/actions/invoices';
import { SubmitButton } from '@/components/SubmitButton';

export default async function DashboardPage() {
  await verifySession();
  const settings = await getSettings();
  const today = todayStr();

  // 1. Hitung statistik pelanggan
  const statsCustomer = await queryOne<{
    total: number;
    active: number;
    isolated: number;
    inactive: number;
  }>(`
    SELECT 
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'active')::int AS active,
      count(*) FILTER (WHERE status = 'isolated')::int AS isolated,
      count(*) FILTER (WHERE status = 'inactive')::int AS inactive
    FROM customers
  `);

  // 2. Hitung statistik invoice bulan ini
  const currentPeriod = today.slice(0, 7) + '-01';
  const statsInvoice = await queryOne<{
    paid_amount: number;
    paid_count: number;
    unpaid_amount: number;
    unpaid_count: number;
  }>(`
    SELECT 
      COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::int AS paid_amount,
      count(*) FILTER (WHERE status = 'paid')::int AS paid_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'unpaid'), 0)::int AS unpaid_amount,
      count(*) FILTER (WHERE status = 'unpaid')::int AS unpaid_count
    FROM invoices
    WHERE period = $1
  `, [currentPeriod]);

  // 3. Pelanggan yang mendekati tanggal isolir atau sedang terisolir
  const upcomingIsolir = await query<{
    id: number;
    name: string;
    code: string;
    pppoe_username: string;
    isolir_day: number;
    status: string;
    package_name: string;
    unpaid_invoices: number;
  }>(`
    SELECT 
      c.id, c.name, c.code, c.pppoe_username, c.isolir_day, c.status, p.name AS package_name,
      count(i.id)::int AS unpaid_invoices
    FROM customers c
    JOIN packages p ON p.id = c.package_id
    LEFT JOIN invoices i ON i.customer_id = c.id AND i.status = 'unpaid'
    WHERE c.status IN ('active', 'isolated')
    GROUP BY c.id, c.name, c.code, c.pppoe_username, c.isolir_day, c.status, p.name
    ORDER BY (c.status = 'isolated') DESC, c.isolir_day ASC
    LIMIT 6
  `);

  // 4. Log aktivitas terbaru
  const recentLogs = await query<{
    id: number;
    level: string;
    action: string;
    message: string;
    created_at: string;
  }>(`
    SELECT id, level, action, message, created_at 
    FROM activity_logs 
    ORDER BY created_at DESC 
    LIMIT 5
  `);

  const routers = await listRoutersWithStats();
  const enabledRouters = routers.filter((r) => r.enabled).length;
  const unassigned =
    (await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM customers WHERE router_id IS NULL'))?.n ?? 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Operasional</h1>
          <p className="page-desc">
            Ringkasan status pelanggan PPPoE, penagihan bulanan, dan router MikroTik.
          </p>
        </div>
        <div className="header-actions">
          <form action={triggerGenerateInvoices}>
            <SubmitButton variant="secondary" size="sm">
              ⚡ Buat Invoice Bulan Ini
            </SubmitButton>
          </form>
          <form action={triggerBillingCycle}>
            <SubmitButton variant="primary" size="sm">
              🔄 Jalankan Cek Isolir Sekarang
            </SubmitButton>
          </form>
        </div>
      </div>

      {/* Router Status Strip (multi-router) */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: routers.length ? '14px' : 0 }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
              {routers.length
                ? `📡 ${enabledRouters} dari ${routers.length} router MikroTik aktif`
                : '⚠️ Belum ada router MikroTik terhubung'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {routers.length
                ? `Otomatis isolir: ${settings.auto_isolir === 'true' ? 'Aktif' : 'Nonaktif'}.` +
                  (unassigned ? ` ${unassigned} pelanggan belum dipasangkan ke router.` : '')
                : 'Sistem berjalan dalam mode pencatatan lokal. Tambahkan router di menu Pengaturan.'}
            </div>
          </div>
          <Link href="/routers" className="btn btn-secondary btn-sm">
            Kelola Router →
          </Link>
        </div>
        {routers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
            {routers.map((r) => (
              <Link
                key={r.id}
                href={`/customers?router=${r.id}`}
                style={{
                  display: 'block',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: `1px solid ${r.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.25)'}`,
                  background: r.enabled ? 'rgba(16, 185, 129, 0.06)' : 'rgba(148, 163, 184, 0.06)',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                  <span className="badge-dot" style={{ background: r.enabled ? '#10b981' : '#94a3b8' }} />
                  {r.name}
                  {r.is_default && <span style={{ fontSize: '10px', color: '#fbbf24' }}>★</span>}
                </div>
                <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 6px' }}>
                  {r.host}:{r.port}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{r.customer_total}</strong> pelanggan •{' '}
                  <span style={{ color: '#f87171' }}>{r.customer_isolated} isolir</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Stat Grid */}
      <div className="stat-grid">
        <div className="stat-card" style={{ '--stat-glow': '#3b82f6' } as React.CSSProperties}>
          <div className="stat-card-header">
            <span className="stat-title">Total Pelanggan</span>
            <div className="stat-icon">👥</div>
          </div>
          <div className="stat-value">{statsCustomer?.total ?? 0}</div>
          <div className="stat-sub">
            <span style={{ color: '#34d399', fontWeight: 600 }}>{statsCustomer?.active ?? 0} Aktif</span> •{' '}
            <span>{statsCustomer?.inactive ?? 0} Berhenti</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-glow': '#ef4444' } as React.CSSProperties}>
          <div className="stat-card-header">
            <span className="stat-title">Pelanggan Terisolir</span>
            <div className="stat-icon" style={{ color: '#f87171' }}>🛡️</div>
          </div>
          <div className="stat-value" style={{ color: '#f87171' }}>
            {statsCustomer?.isolated ?? 0}
          </div>
          <div className="stat-sub">
            Profil PPP dialihkan ke profil isolir tiap router
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-glow': '#10b981' } as React.CSSProperties}>
          <div className="stat-card-header">
            <span className="stat-title">Lunas Bulan Ini ({periodLabel(currentPeriod)})</span>
            <div className="stat-icon" style={{ color: '#34d399' }}>💰</div>
          </div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            {rupiah(statsInvoice?.paid_amount ?? 0)}
          </div>
          <div className="stat-sub">
            {statsInvoice?.paid_count ?? 0} invoice telah diselesaikan
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-glow': '#f59e0b' } as React.CSSProperties}>
          <div className="stat-card-header">
            <span className="stat-title">Belum Dibayar Bulan Ini</span>
            <div className="stat-icon" style={{ color: '#fbbf24' }}>⏳</div>
          </div>
          <div className="stat-value" style={{ color: '#fbbf24' }}>
            {rupiah(statsInvoice?.unpaid_amount ?? 0)}
          </div>
          <div className="stat-sub">
            {statsInvoice?.unpaid_count ?? 0} tagihan menunggu pembayaran
          </div>
        </div>
      </div>

      {/* Main Grid: Upcoming Isolir & Activity Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Kolom 1: Status Pelanggan & Jadwal Isolir */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Status & Tanggal Isolir</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pelanggan terisolir & tanggal isolir terdekat</p>
            </div>
            <Link href="/customers" className="btn btn-secondary btn-sm">
              Semua Pelanggan →
            </Link>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>PPPoE User</th>
                  <th>Tgl Isolir</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {upcomingIsolir.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-dim)' }}>
                      Belum ada pelanggan terdaftar.
                    </td>
                  </tr>
                ) : (
                  upcomingIsolir.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{c.package_name}</div>
                      </td>
                      <td>
                        <code className="font-mono" style={{ color: '#059669', fontWeight: 600 }}>{c.pppoe_username}</code>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Tgl {c.isolir_day}</span>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tiap bulan</div>
                      </td>
                      <td>
                        <span className={`badge ${c.status === 'active' ? 'badge-active' : c.status === 'isolated' ? 'badge-isolated' : 'badge-inactive'}`}>
                          <span className="badge-dot" />
                          {c.status === 'active' ? 'Aktif' : c.status === 'isolated' ? 'Terisolir' : 'Berhenti'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/customers/${c.id}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom 2: Log Aktivitas Terbaru */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Log Aktivitas Sistem</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Audit trail pembuatan invoice, pembayaran & isolir</p>
            </div>
            <Link href="/logs" className="btn btn-secondary btn-sm">
              Semua Log →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-dim)' }}>
                Belum ada catatan aktivitas.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '14px', marginTop: '2px' }}>
                    {log.level === 'error' ? '❌' : log.level === 'warning' ? '⚠️' : log.level === 'success' ? '✅' : 'ℹ️'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', wordBreak: 'break-word' }}>
                      {log.message}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '3px' }}>
                      {formatDateTime(log.created_at)} • Aksi: <code style={{ color: '#93c5fd' }}>{log.action}</code>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
