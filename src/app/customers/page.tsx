import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { formatDate } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { deleteCustomerDirect } from '@/app/actions/customers';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';
import { Avatar, EmptyState, Icon, PageHeader, StatusBadge } from '@/components/ui';
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
      <PageHeader
        title="Pelanggan"
        desc="Data pelanggan PPPoE, paket, dan jadwal tagihan serta isolir."
        actions={
          <>
            <a href="/api/customers/export" className="btn btn-secondary" download title="Unduh semua pelanggan (CSV)">
              <Icon name="download" size={16} /> Export
            </a>
            <Link href="/customers/import" className="btn btn-secondary">
              <Icon name="upload" size={16} /> Import
            </Link>
            <Link href="/customers/new" className="btn btn-primary">
              <Icon name="plus" size={16} /> Tambah Pelanggan
            </Link>
          </>
        }
      />

      {routers.length > 0 && (
        <div className="router-switcher" aria-label="Filter router">
          <Link href={qs({ router: '' })} className={`router-tab ${!router ? 'is-active' : ''}`}>
            Semua router <span className="router-tab-count">{allCount}</span>
          </Link>
          {routers.map((r) => (
            <Link
              key={r.id}
              href={qs({ router: String(r.id) })}
              className={`router-tab ${router === String(r.id) ? 'is-active' : ''}`}
              title={`${r.host}:${r.port}${r.enabled ? '' : ' (nonaktif)'}`}
            >
              <span className="badge-dot" style={{ background: r.enabled ? '#22c55e' : '#94a3b8' }} />
              {r.name}
              <span className="router-tab-count">{r.customer_total}</span>
            </Link>
          ))}
          {unassigned > 0 && (
            <Link href={qs({ router: 'none' })} className={`router-tab ${router === 'none' ? 'is-active' : ''}`}>
              Tanpa router <span className="router-tab-count">{unassigned}</span>
            </Link>
          )}
        </div>
      )}

      <section className="panel">
        <form method="GET" className="toolbar">
          {router && <input type="hidden" name="router" value={router} />}
          <div className="search-field">
            <Icon name="search" size={16} />
            <input name="q" type="text" defaultValue={q} placeholder="Cari nama, user PPPoE, telepon, kode…" className="form-input" />
          </div>
          <select name="status" defaultValue={status} className="form-select" style={{ maxWidth: '170px' }}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="isolated">Terisolir</option>
            <option value="inactive">Berhenti</option>
          </select>
          <button type="submit" className="btn btn-secondary">Terapkan</button>
          {(q || status || router) && (
            <Link href="/customers" className="btn btn-secondary text-muted">Reset</Link>
          )}
          <span className="toolbar-spacer">{customers.length} pelanggan</span>
        </form>

        {customers.length === 0 ? (
          <EmptyState
            icon="users"
            title={q || status || router ? 'Tidak ada yang cocok' : 'Belum ada pelanggan'}
            action={
              q || status || router ? (
                <Link href="/customers" className="btn btn-secondary btn-sm">Reset filter</Link>
              ) : (
                <Link href="/customers/new" className="btn btn-primary btn-sm"><Icon name="plus" size={15} /> Tambah Pelanggan</Link>
              )
            }
          >
            {q || status || router ? 'Coba ubah kata kunci atau filter.' : 'Tambahkan manual, atau impor dari CSV / router.'}
          </EmptyState>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th className="col-hide-sm">Paket</th>
                  <th className="col-hide-md">Router</th>
                  <th className="col-hide-sm">Jadwal</th>
                  <th>Status</th>
                  <th className="col-hide-sm" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`} className="person" style={{ color: 'inherit' }}>
                        <Avatar name={c.name} />
                        <div style={{ minWidth: 0 }}>
                          <div className="person-name">{c.name}</div>
                          <div className="person-sub">
                            <span className="code-tag">{c.code}</span> <span className="mono">{c.pppoe_username}</span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="col-hide-sm">
                      <div style={{ fontWeight: 600 }}>
                        {c.package_name}{' '}
                        <span className={`pill ${c.billing_type === 'postpaid' ? 'pill-blue' : 'pill-green'}`} title={c.billing_type === 'postpaid' ? 'Pascabayar' : 'Prabayar'}>
                          {c.billing_type === 'postpaid' ? 'Pasca' : 'Pra'}
                        </span>
                      </div>
                      <div className="person-sub">{rupiah(c.package_price)}/bln</div>
                    </td>
                    <td className="col-hide-md">
                      {c.router_name ? (
                        <span className="router-link-chip"><Icon name="router" size={14} /> {c.router_name}</span>
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                    </td>
                    <td className="col-hide-sm">
                      <div style={{ fontSize: '13px' }}>Tempo tgl <strong>{c.due_day}</strong></div>
                      <div className="person-sub">Isolir tgl <span className="text-danger">{c.isolir_day}</span></div>
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="col-hide-sm" style={{ textAlign: 'right' }}>
                      <div className="action-cell-group">
                        <Link href={`/customers/${c.id}`} className="btn btn-secondary btn-sm col-hide-sm">Detail</Link>
                        <Link href={`/customers/${c.id}/edit`} className="btn btn-secondary btn-sm" title="Edit"><Icon name="edit" size={14} /></Link>
                        <DeleteConfirmForm
                          action={deleteCustomerDirect}
                          confirmMessage={`Hapus pelanggan "${c.name}" (${c.code})?\n\nSemua data tagihan pelanggan ini juga akan terhapus!`}
                        >
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="btn btn-danger btn-sm" title={`Hapus ${c.name}`}>
                            <Icon name="x" size={14} />
                          </button>
                        </DeleteConfirmForm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
