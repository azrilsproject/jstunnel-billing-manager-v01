import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query, queryOne } from '@/lib/db';
import { formatDateTime, periodLabel, todayStr } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { listRoutersWithStats } from '@/lib/routers';
import { triggerBillingCycle, triggerGenerateInvoices } from '@/app/actions/invoices';
import { SubmitButton } from '@/components/SubmitButton';
import { Avatar, EmptyState, Icon, PageHeader, Panel, StatTile, StatusBadge } from '@/components/ui';

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

  const levelTone: Record<string, string> = { error: 'tone-red', warning: 'tone-amber', success: 'tone-green', info: 'tone-blue' };
  const levelIcon = { error: 'x', warning: 'alert', success: 'check', info: 'info' } as const;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        desc={`Ringkasan pelanggan, tagihan ${periodLabel(currentPeriod)}, dan status router.`}
        actions={
          <>
            <form action={triggerGenerateInvoices}>
              <SubmitButton variant="secondary" size="sm">
                <Icon name="receipt" size={15} /> Buat Invoice Bulan Ini
              </SubmitButton>
            </form>
            <form action={triggerBillingCycle}>
              <SubmitButton variant="primary" size="sm">
                <Icon name="refresh" size={15} /> Jalankan Cek Isolir
              </SubmitButton>
            </form>
          </>
        }
      />

      <div className="stats-grid">
        <StatTile
          label="Total pelanggan"
          value={statsCustomer?.total ?? 0}
          sub={<><span className="text-success">{statsCustomer?.active ?? 0} aktif</span> · {statsCustomer?.inactive ?? 0} berhenti</>}
          icon="users"
          tone="blue"
          href="/customers"
        />
        <StatTile
          label="Terisolir"
          value={statsCustomer?.isolated ?? 0}
          sub="Menunggu pembayaran untuk dibuka"
          icon="shield"
          tone="red"
          href="/customers?status=isolated"
        />
        <StatTile
          label="Lunas bulan ini"
          value={rupiah(statsInvoice?.paid_amount ?? 0)}
          sub={`${statsInvoice?.paid_count ?? 0} invoice selesai`}
          icon="wallet"
          tone="green"
          href="/invoices"
        />
        <StatTile
          label="Belum dibayar"
          value={rupiah(statsInvoice?.unpaid_amount ?? 0)}
          sub={`${statsInvoice?.unpaid_count ?? 0} tagihan menunggu`}
          icon="clock"
          tone="amber"
          href="/invoices"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <Panel
          title="Router MikroTik"
          sub={
            routers.length
              ? `${enabledRouters} dari ${routers.length} router aktif · Isolir otomatis ${settings.auto_isolir === 'true' ? 'aktif' : 'nonaktif'}` +
                (unassigned ? ` · ${unassigned} pelanggan belum punya router` : '')
              : 'Belum ada router terhubung'
          }
          action={
            <Link href="/routers" className="btn btn-secondary btn-sm">
              Kelola Router <Icon name="arrow" size={14} />
            </Link>
          }
        >
          {routers.length === 0 ? (
            <EmptyState icon="router" title="Belum ada router" action={<Link href="/routers?router=new" className="btn btn-primary btn-sm"><Icon name="plus" size={15} /> Tambah Router</Link>}>
              Sistem berjalan dalam mode pencatatan lokal sampai router ditambahkan.
            </EmptyState>
          ) : (
            <div className="router-chips">
              {routers.map((r) => (
                <Link key={r.id} href={`/customers?router=${r.id}`} className="router-chip">
                  <div className="router-chip-name">
                    <span className="badge-dot" style={{ background: r.enabled ? '#22c55e' : '#94a3b8' }} />
                    {r.name}
                    {r.is_default && <span className="text-warning" style={{ fontSize: '11px' }}>★ default</span>}
                  </div>
                  <div className="router-chip-host">{r.host}:{r.port}</div>
                  <div className="router-chip-meta">
                    <strong style={{ color: 'var(--text-main)' }}>{r.customer_total}</strong> pelanggan ·{' '}
                    <span className={r.customer_isolated ? 'text-danger' : ''}>{r.customer_isolated} isolir</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid-2">
        <Panel
          title="Perlu perhatian"
          sub="Pelanggan terisolir dan jadwal isolir terdekat"
          flush
          action={
            <Link href="/customers" className="btn btn-secondary btn-sm">
              Semua <Icon name="arrow" size={14} />
            </Link>
          }
        >
          {upcomingIsolir.length === 0 ? (
            <EmptyState icon="users" title="Belum ada pelanggan">
              Tambahkan pelanggan pertama untuk mulai menagih.
            </EmptyState>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th>Isolir</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {upcomingIsolir.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="person">
                          <Avatar name={c.name} />
                          <div style={{ minWidth: 0 }}>
                            <div className="person-name">{c.name}</div>
                            <div className="person-sub">{c.package_name} · <span className="mono">{c.pppoe_username}</span></div>
                          </div>
                        </div>
                      </td>
                      <td className="nowrap">Tgl {c.isolir_day}</td>
                      <td>
                        <StatusBadge status={c.status as 'active' | 'isolated' | 'inactive'} />
                        {c.unpaid_invoices > 0 && <div className="person-sub">{c.unpaid_invoices} tagihan</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/customers/${c.id}`} className="btn btn-secondary btn-sm">Detail</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Aktivitas terbaru"
          sub="Invoice, pembayaran, dan isolir"
          flush
          action={
            <Link href="/logs" className="btn btn-secondary btn-sm">
              Semua <Icon name="arrow" size={14} />
            </Link>
          }
        >
          {recentLogs.length === 0 ? (
            <EmptyState icon="list" title="Belum ada aktivitas" />
          ) : (
            <div className="feed">
              {recentLogs.map((log) => (
                <div key={log.id} className="feed-item">
                  <span className={`feed-dot ${levelTone[log.level] ?? 'tone-slate'}`}>
                    <Icon name={levelIcon[log.level as keyof typeof levelIcon] ?? 'info'} size={14} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="feed-msg">{log.message}</div>
                    <div className="feed-meta">{formatDateTime(log.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
