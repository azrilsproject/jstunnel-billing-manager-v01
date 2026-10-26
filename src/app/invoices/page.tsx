import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { formatDate, monthOptions, periodLabel, todayStr } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { createInvoiceWaLink } from '@/lib/whatsapp';
import { payInvoice, triggerGenerateInvoices, deleteInvoiceAction } from '@/app/actions/invoices';
import { SubmitButton } from '@/components/SubmitButton';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';

type Props = {
  searchParams: Promise<{ period?: string; status?: string; q?: string }>;
};

export default async function InvoicesPage({ searchParams }: Props) {
  await verifySession();
  const { period = '', status = '', q = '' } = await searchParams;

  const today = todayStr();
  const [currentY, currentM] = today.split('-').map(Number);
  const periods = monthOptions(currentY, currentM, 12, 1);

  let where = '1=1';
  const params: unknown[] = [];

  if (period) {
    params.push(period + '-01');
    where += ` AND i.period = $${params.length}`;
  }

  if (status && ['unpaid', 'paid', 'void'].includes(status)) {
    params.push(status);
    where += ` AND i.status = $${params.length}`;
  }

  if (q) {
    params.push(`%${q}%`);
    where += ` AND (i.number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.code ILIKE $${params.length} OR c.pppoe_username ILIKE $${params.length})`;
  }

  const settings = await getSettings();

  const invoices = await query<{
    id: number;
    number: string;
    period: string;
    package_name: string;
    amount: number;
    issue_date: string;
    due_date: string;
    isolir_date: string;
    status: 'unpaid' | 'paid' | 'void';
    paid_at: string | null;
    payment_method: string | null;
    customer_id: number;
    customer_name: string;
    customer_code: string;
    customer_phone: string | null;
    pppoe_username: string;
  }>(`
    SELECT 
      i.id, i.number, i.period, i.package_name, i.amount, i.issue_date, i.due_date, i.isolir_date,
      i.status, i.paid_at, i.payment_method,
      c.id AS customer_id, c.name AS customer_name, c.code AS customer_code, c.phone AS customer_phone,
      c.pppoe_username
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE ${where}
    ORDER BY i.period DESC, i.due_date ASC, i.id DESC
  `, params);

  // Ringkasan subtotal dari list terfilter
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = invoices.filter((i) => i.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const unpaidAmount = invoices.filter((i) => i.status === 'unpaid').reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice & Penagihan Bulanan</h1>
          <p className="page-desc">
            Daftar tagihan bulanan pelanggan, tanggal jatuh tempo, dan tanggal isolir otomatis.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/invoices/new" className="btn btn-primary">
            ➕ Buat Invoice Manual
          </Link>
          <form action={triggerGenerateInvoices}>
            <SubmitButton variant="secondary">
              ⚡ Generate Otomatis Bulan Ini
            </SubmitButton>
          </form>
        </div>
      </div>

      {/* Filter & Subtotal Card */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <form method="GET" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Cari nomor invoice, nama, user PPPoE..."
            className="form-input"
            style={{ maxWidth: '280px' }}
          />

          <select name="period" defaultValue={period} className="form-select" style={{ maxWidth: '200px' }}>
            <option value="">Semua Periode Bulan</option>
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <select name="status" defaultValue={status} className="form-select" style={{ maxWidth: '170px' }}>
            <option value="">Semua Status</option>
            <option value="unpaid">Belum Bayar</option>
            <option value="paid">Lunas</option>
            <option value="void">Dibatalkan</option>
          </select>

          <button type="submit" className="btn btn-secondary">
            Filter
          </button>

          {(q || period || status) && (
            <Link href="/invoices" className="btn btn-secondary" style={{ color: 'var(--text-muted)' }}>
              Reset
            </Link>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', fontSize: '13px' }}>
            <div>
              Total: <strong style={{ color: 'var(--text-main)' }}>{rupiah(totalAmount)}</strong>
            </div>
            <div>
              Lunas: <strong style={{ color: '#34d399' }}>{rupiah(paidAmount)}</strong>
            </div>
            <div>
              Belum Bayar: <strong style={{ color: '#fbbf24' }}>{rupiah(unpaidAmount)}</strong>
            </div>
          </div>
        </form>
      </div>

      {/* Tabel Invoices */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '170px' }}>Invoice & Periode</th>
              <th style={{ minWidth: '160px' }}>Pelanggan</th>
              <th style={{ width: '120px' }}>Nominal</th>
              <th style={{ width: '115px', textAlign: 'center' }}>Jatuh Tempo</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Tgl Isolir</th>
              <th style={{ width: '125px', textAlign: 'center' }}>Status</th>
              <th style={{ width: '135px' }}>Info Bayar</th>
              <th style={{ width: '215px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                  Tidak ada invoice yang sesuai dengan kriteria filter.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="font-mono" style={{ fontWeight: 700, color: '#3b82f6', fontSize: '13.5px' }}>
                      {inv.number}
                    </Link>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📅 {periodLabel(inv.period)}
                    </div>
                  </td>
                  <td>
                    <Link href={`/customers/${inv.customer_id}`} style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {inv.customer_name}
                    </Link>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                      PPPoE: <code style={{ color: '#059669', fontWeight: 600 }}>{inv.pppoe_username}</code>
                    </div>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--text-main)', fontSize: '13.5px' }}>{rupiah(inv.amount)}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{inv.package_name}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="date-chip date-chip-warning">
                      📅 {formatDate(inv.due_date)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="date-chip date-chip-danger">
                      🛡️ {formatDate(inv.isolir_date)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${inv.status === 'paid' ? 'badge-paid' : inv.status === 'unpaid' ? 'badge-unpaid' : 'badge-void'}`}>
                      <span className="badge-dot" />
                      {inv.status === 'paid' ? 'Lunas' : inv.status === 'unpaid' ? 'Belum Bayar' : 'Batal'}
                    </span>
                  </td>
                  <td>
                    {inv.paid_at ? (
                      <div>
                        <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '12.5px' }}>{formatDate(inv.paid_at)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                          💳 {inv.payment_method || 'Cash'}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6b7280', display: 'inline-block' }} />
                          Menunggu Bayar
                        </div>
                        <div style={{ fontSize: '11px', color: 'transparent', marginTop: '2px', userSelect: 'none' }}>
                          -
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="action-cell-group">
                      <a
                        href={createInvoiceWaLink({
                          customerName: inv.customer_name,
                          customerPhone: inv.customer_phone,
                          invoiceNumber: inv.number,
                          period: inv.period,
                          packageName: inv.package_name,
                          amount: inv.amount,
                          dueDate: inv.due_date,
                          isolirDate: inv.isolir_date,
                          status: inv.status,
                          companyName: settings.company_name,
                          bankInfo: settings.bank_info,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-wa table-action-btn"
                        title={`Kirim WA ke ${inv.customer_name} (${inv.customer_phone || 'tanpa nomor'})`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                        </svg>
                        <span>WA</span>
                      </a>

                      <Link href={`/invoices/${inv.id}`} className="btn btn-secondary table-action-btn">
                        Cetak
                      </Link>

                      {inv.status === 'unpaid' ? (
                        <form action={payInvoice}>
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="payment_method" value="Cash" />
                          <button
                            type="submit"
                            className="btn btn-success table-action-btn"
                          >
                            Bayar
                          </button>
                        </form>
                      ) : (
                        <span className="btn-static-paid">
                          ✓ Lunas
                        </span>
                      )}

                      <DeleteConfirmForm
                        action={deleteInvoiceAction}
                        confirmMessage={`Hapus invoice ${inv.number}?`}
                      >
                        <input type="hidden" name="id" value={inv.id} />
                        <button
                          type="submit"
                          className="btn btn-danger table-action-btn"
                          title={`Hapus Invoice ${inv.number}`}
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
