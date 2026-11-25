import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { formatDate } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { deleteCustomerDirect } from '@/app/actions/customers';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';
import { listRoutersWithStats } from '@/lib/routers';

type Props = {
  searchParams: Promise<{ q?: string; status?: string; router?: string }>;
};

export default async function CustomersPage({ searchParams }: Props) {
  await verifySession();
  const { q = '', status = '', router = '' } = await searchParams;
  const routers = await listRoutersWithStats();
  const unassigned =
    (await query<{ n: number }>('SELECT count(*)::int AS n FROM customers WHERE router_id IS NULL'))[0]?.n ?? 0;
  const allCount = routers.reduce((n, r) => n + r.customer_total, 0) + unassigned;

  let where = '1=1';
  const params: unknown[] = [];

  if (q) {
    params.push(`%${q}%`);
    where += ` AND (c.name ILIKE $${params.length} OR c.pppoe_username ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.code ILIKE $${params.length})`;
  }

  if (status && ['active', 'isolated', 'inactive'].includes(status)) {
    params.push(status);
    where += ` AND c.status = $${params.length}`;
  }

  if (router === 'none') {
    where += ' AND c.router_id IS NULL';
  } else if (router && parseInt(router, 10)) {
    params.push(parseInt(router, 10));
    where += ` AND c.router_id = $${params.length}`;
  }

  const qs = (patch: Record<string, string>) => {
    const merged: Record<string, string> = { q, status, router, ...patch };
    const p = new URLSearchParams(Object.entries(merged).filter(([, v]) => !!v));
    const out = p.toString();
    return out ? `/customers?${out}` : '/customers';
  };

  const customers = await query<{
    id: number;
    code: string;
    name: string;
    phone: string | null;
    pppoe_username: string;
    status: 'active' | 'isolated' | 'inactive';
    billing_type: 'prepaid' | 'postpaid';
    active_date: string;
    due_day: number;
    isolir_day: number;
    package_name: string;
    package_price: number;
    router_name: string | null;
  }>(`
    SELECT 
      c.id, c.code, c.name, c.phone, c.pppoe_username, c.status, c.billing_type,
      c.active_date, c.due_day, c.isolir_day,
      p.name AS package_name, p.price AS package_price, r.name AS router_name
    FROM customers c
    JOIN packages p ON p.id = c.package_id
    LEFT JOIN routers r ON r.id = c.router_id
    WHERE ${where}
    ORDER BY c.created_at DESC
  `, params);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pelanggan PPPoE</h1>
          <p className="page-desc">
            Kelola data pelanggan, kredensial secret PPPoE, tanggal aktif, dan tanggal isolir.
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href="/api/customers/export"
            className="btn btn-secondary"
            download
            title="Download seluruh data pelanggan ke format CSV"
          >
            📤 Export CSV
          </a>
          <Link href="/customers/import" className="btn btn-secondary">
            📥 Import CSV
          </Link>
          <Link href="/customers/new" className="btn btn-primary">
            + Tambah Pelanggan
          </Link>
        </div>
      </div>

      {/* Router Switcher */}
      {routers.length > 0 && (
        <div className="router-switcher" aria-label="Filter router">
          <Link href={qs({ router: '' })} className={`router-tab ${!router ? 'is-active' : ''}`}>
            Semua Router <span className="router-tab-count">{allCount}</span>
          </Link>
          {routers.map((r) => (
            <Link
              key={r.id}
              href={qs({ router: String(r.id) })}
              className={`router-tab ${router === String(r.id) ? 'is-active' : ''}`}
              title={`${r.host}:${r.port}${r.enabled ? '' : ' (nonaktif)'}`}
            >
              <span className="badge-dot" style={{ background: r.enabled ? '#10b981' : '#94a3b8' }} />
              {r.name}
              <span className="router-tab-count">{r.customer_total}</span>
            </Link>
          ))}
          {unassigned > 0 && (
            <Link href={qs({ router: 'none' })} className={`router-tab ${router === 'none' ? 'is-active' : ''}`}>
              Tanpa Router <span className="router-tab-count">{unassigned}</span>
            </Link>
          )}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <form method="GET" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {router && <input type="hidden" name="router" value={router} />}
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Cari nama, user PPPoE, telepon, kode..."
            className="form-input"
            style={{ maxWidth: '320px' }}
          />

          <select name="status" defaultValue={status} className="form-select" style={{ maxWidth: '180px' }}>
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="isolated">Terisolir</option>
            <option value="inactive">Berhenti</option>
          </select>

          <button type="submit" className="btn btn-secondary">
            Cari / Filter
          </button>

          {(q || status || router) && (
            <Link href="/customers" className="btn btn-secondary" style={{ color: 'var(--text-muted)' }}>
              Reset
            </Link>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)' }}>
            Total: <strong>{customers.length}</strong> pelanggan ditemukan
          </div>
        </form>
      </div>

      {/* Customer Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Kode / Pelanggan</th>
              <th>PPPoE Secret</th>
              <th>Paket Langganan</th>
              <th>Router</th>
              <th>Tgl Aktif</th>
              <th>Jatuh Tempo</th>
              <th style={{ textAlign: 'center' }}>Tgl Isolir</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                  Tidak ada pelanggan yang cocok dengan pencarian atau belum ada data.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="font-mono" style={{ fontSize: '11px', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        {c.code}
                      </span>
                      <strong style={{ color: 'var(--text-main)' }}>{c.name}</strong>
                    </div>
                    {c.phone && <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>📞 {c.phone}</div>}
                  </td>
                  <td>
                    <code className="font-mono" style={{ color: '#059669', fontWeight: 600 }}>{c.pppoe_username}</code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{c.package_name}</div>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: c.billing_type === 'postpaid' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: c.billing_type === 'postpaid' ? '#2563eb' : '#059669',
                          border: `1px solid ${c.billing_type === 'postpaid' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                        }}
                        title={c.billing_type === 'postpaid' ? 'Pascabayar (Ditagihkan bulan depan)' : 'Prabayar (Ditagihkan di tanggal aktif)'}
                      >
                        {c.billing_type === 'postpaid' ? 'Pasca' : 'Pra'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{rupiah(c.package_price)}/bln</div>
                  </td>
                  <td>
                    {c.router_name ? (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd' }}>📡 {c.router_name}</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontSize: '13px' }}>{formatDate(c.active_date)}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fcd34d', fontSize: '13px' }}>Tgl {c.due_day}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tiap bulan</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="date-chip date-chip-danger">
                      🛡️ Tgl {c.isolir_day}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${c.status === 'active' ? 'badge-active' : c.status === 'isolated' ? 'badge-isolated' : 'badge-inactive'}`}>
                      <span className="badge-dot" />
                      {c.status === 'active' ? 'Aktif' : c.status === 'isolated' ? 'Terisolir' : 'Berhenti'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="action-cell-group">
                      <Link href={`/customers/${c.id}`} className="btn btn-secondary table-action-btn">
                        Detail
                      </Link>
                      <Link href={`/customers/${c.id}/edit`} className="btn btn-secondary table-action-btn">
                        Edit
                      </Link>
                      <DeleteConfirmForm
                        action={deleteCustomerDirect}
                        confirmMessage={`Hapus pelanggan "${c.name}" (${c.code})?\n\nSemua data tagihan pelanggan ini juga akan terhapus!`}
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="btn btn-danger table-action-btn"
                          title={`Hapus Pelanggan ${c.name}`}
                        >
                          Hapus
                        </button>
                      </DeleteConfirmForm>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
