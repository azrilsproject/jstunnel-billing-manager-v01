import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { formatDate } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { deleteCustomerDirect } from '@/app/actions/customers';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function CustomersPage({ searchParams }: Props) {
  await verifySession();
  const { q = '', status = '' } = await searchParams;

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

  const customers = await query<{
    id: number;
    code: string;
    name: string;
    phone: string | null;
    pppoe_username: string;
    status: 'active' | 'isolated' | 'inactive';
    active_date: string;
    due_day: number;
    isolir_day: number;
    package_name: string;
    package_price: number;
  }>(`
    SELECT 
      c.id, c.code, c.name, c.phone, c.pppoe_username, c.status,
      c.active_date, c.due_day, c.isolir_day,
      p.name AS package_name, p.price AS package_price
    FROM customers c
    JOIN packages p ON p.id = c.package_id
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

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <form method="GET" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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

          {(q || status) && (
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
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
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
                    <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{c.package_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{rupiah(c.package_price)}/bln</div>
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
