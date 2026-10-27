import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { getCustomer } from '@/lib/billing';
import { query } from '@/lib/db';
import { formatDate, periodLabel } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { getActiveSession, isMikrotikEnabled } from '@/lib/mikrotik';
import { SubmitButton } from '@/components/SubmitButton';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';
import {
  generateCustomerInvoice,
  isolateNow,
  restoreNow,
  setInactive,
  syncNow,
  deleteCustomerDirect,
} from '@/app/actions/customers';
import { payInvoice, unpayInvoice, deleteInvoiceAction } from '@/app/actions/invoices';
import { createInvoiceWaLink } from '@/lib/whatsapp';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
};

export default async function CustomerDetailPage({ params, searchParams }: Props) {
  await verifySession();
  const { id } = await params;
  const { msg } = await searchParams;
  const customerId = parseInt(id, 10);
  if (!customerId) notFound();

  const customer = await getCustomer(customerId);
  if (!customer) notFound();

  const settings = await getSettings();

  // Ambil sesi aktif PPPoE dari MikroTik realtime jika router aktif
  let activeSession: { address: string; uptime: string; callerId: string } | null = null;
  if (isMikrotikEnabled(settings)) {
    try {
      activeSession = await getActiveSession(customer.pppoe_username);
    } catch {
      // Router offline atau timeout
    }
  }

  // Riwayat invoice pelanggan
  const invoices = await query<{
    id: number;
    number: string;
    period: string;
    amount: number;
    issue_date: string;
    due_date: string;
    isolir_date: string;
    status: 'unpaid' | 'paid' | 'void';
    paid_at: string | null;
    payment_method: string | null;
  }>(`
    SELECT id, number, period, amount, issue_date, due_date, isolir_date, status, paid_at, payment_method
    FROM invoices
    WHERE customer_id = $1
    ORDER BY period DESC
  `, [customer.id]);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/customers" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            ← Kembali ke Daftar Pelanggan
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            <h1 className="page-title">{customer.name}</h1>
            <span className={`badge ${customer.status === 'active' ? 'badge-active' : customer.status === 'isolated' ? 'badge-isolated' : 'badge-inactive'}`}>
              <span className="badge-dot" />
              {customer.status === 'active' ? 'Layanan Aktif' : customer.status === 'isolated' ? 'Layanan Terisolir' : 'Berhenti'}
            </span>
            <span
              className="badge"
              style={{
                background: customer.billing_type === 'postpaid' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                color: customer.billing_type === 'postpaid' ? '#3b82f6' : '#10b981',
                borderColor: customer.billing_type === 'postpaid' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                fontWeight: 700,
              }}
            >
              {customer.billing_type === 'postpaid' ? '📅 Pascabayar' : '⚡ Prabayar'}
            </span>
          </div>
          <p className="page-desc">
            Kode Pelanggan: <strong style={{ color: '#fff' }}>{customer.code}</strong> • No. HP: {customer.phone || '-'}
          </p>
        </div>

        <div className="header-actions">
          <Link href={`/customers/${customer.id}/edit`} className="btn btn-secondary">
            ✏️ Edit Pelanggan
          </Link>

          {customer.status === 'active' && (
            <form action={isolateNow}>
              <input type="hidden" name="id" value={customer.id} />
              <SubmitButton variant="danger" loadingText="Mengisolir...">
                🛡️ Isolir Sekarang
              </SubmitButton>
            </form>
          )}

          {customer.status === 'isolated' && (
            <form action={restoreNow}>
              <input type="hidden" name="id" value={customer.id} />
              <SubmitButton variant="success" loadingText="Membuka...">
                🔓 Buka Isolir Sekarang
              </SubmitButton>
            </form>
          )}

          <form action={syncNow}>
            <input type="hidden" name="id" value={customer.id} />
            <SubmitButton variant="secondary" loadingText="Sinkronisasi...">
              🔄 Sync Router
            </SubmitButton>
          </form>

          <form action={generateCustomerInvoice}>
            <input type="hidden" name="id" value={customer.id} />
            <SubmitButton variant="primary" loadingText="Membuat...">
              ⚡ Buat Invoice Bulan Ini
            </SubmitButton>
          </form>

          <DeleteConfirmForm
            action={deleteCustomerDirect}
            confirmMessage={`Hapus pelanggan "${customer.name}" (${customer.code}) secara permanen?\n\nSemua riwayat tagihan pelanggan ini juga akan ikut terhapus.`}
          >
            <input type="hidden" name="id" value={customer.id} />
            <SubmitButton variant="danger" loadingText="Menghapus...">
              🗑️ Hapus Pelanggan
            </SubmitButton>
          </DeleteConfirmForm>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success" style={{ marginBottom: '24px' }}>
          <span>✅</span>
          <span>{msg}</span>
        </div>
      )}

      {/* Grid Informasi Utama */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Info Paket & Kredensial PPPoE */}
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
            Akun PPPoE & Paket Internet
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Paket Layanan</span>
              <strong style={{ color: '#fff' }}>{customer.package_name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tarif Bulanan</span>
              <strong style={{ color: '#34d399' }}>{rupiah(customer.price)}/bln</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>PPPoE Username</span>
              <code className="font-mono" style={{ color: '#93c5fd' }}>{customer.pppoe_username}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>PPPoE Password</span>
              <code className="font-mono" style={{ color: '#fcd34d' }}>{customer.pppoe_password}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Profil di MikroTik</span>
              <span>
                {customer.status === 'isolated' ? (
                  <span style={{ color: '#f87171', fontWeight: 700 }}>{settings.isolir_profile} (Terisolir)</span>
                ) : (
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>{customer.mikrotik_profile}</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Tanggal Aktif & Jadwal Isolir */}
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
            Jadwal Penagihan & Isolir
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sistem Tagihan</span>
              <strong style={{ color: customer.billing_type === 'postpaid' ? '#3b82f6' : '#10b981' }}>
                {customer.billing_type === 'postpaid' ? '📅 Pascabayar (Ditagihkan bulan depan)' : '⚡ Prabayar (Ditagihkan di tanggal aktif)'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Pemasangan / Aktif</span>
              <strong style={{ color: '#fff' }}>{formatDate(customer.active_date)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Jatuh Tempo</span>
              <strong style={{ color: '#fcd34d' }}>Tiap Tanggal {customer.due_day}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Isolir Otomatis</span>
              <strong style={{ color: '#f87171' }}>Tiap Tanggal {customer.isolir_day}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Alamat Pemasangan</span>
              <span style={{ color: '#fff', maxWidth: '180px', textAlign: 'right' }}>
                {customer.address || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Status Sesi MikroTik Realtime */}
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
            Status Router MikroTik
          </h2>
          {activeSession ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700 }}>
                <span className="badge-dot" style={{ background: '#10b981' }} />
                PPPoE Sedang Terhubung (Online)
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>IP Client</span>
                <code className="font-mono" style={{ color: '#fff' }}>{activeSession.address}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Uptime</span>
                <span style={{ color: '#fff' }}>{activeSession.uptime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Caller ID / MAC</span>
                <code className="font-mono" style={{ color: 'var(--text-dim)' }}>{activeSession.callerId}</code>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              <div>💤 PPPoE Sedang Tidak Terhubung (Offline)</div>
              <div style={{ fontSize: '11.5px', marginTop: '4px' }}>
                ONT/Modem pelanggan mati atau router belum terkoneksi.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Riwayat Invoice & Tagihan */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Riwayat Invoice & Tagihan</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Daftar tagihan bulanan dan status pembayaran</p>
          </div>
          <Link
            href={`/invoices/new?customerId=${customer.id}`}
            className="btn btn-secondary btn-sm"
          >
            ➕ Buat Invoice Baru
          </Link>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Periode Tagihan</th>
                <th>Jumlah</th>
                <th>Jatuh Tempo</th>
                <th>Batas Isolir</th>
                <th>Status</th>
                <th>Tgl Bayar</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                    Belum ada invoice yang dibuat untuk pelanggan ini.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/invoices/${inv.id}`} className="font-mono" style={{ fontWeight: 600 }}>
                        {inv.number}
                      </Link>
                    </td>
                    <td>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{periodLabel(inv.period)}</span>
                    </td>
                    <td>
                      <strong style={{ color: '#fff' }}>{rupiah(inv.amount)}</strong>
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
                    <td>
                      <span className={`badge ${inv.status === 'paid' ? 'badge-paid' : inv.status === 'unpaid' ? 'badge-unpaid' : 'badge-void'}`}>
                        <span className="badge-dot" />
                        {inv.status === 'paid' ? 'Lunas' : inv.status === 'unpaid' ? 'Belum Bayar' : 'Batal'}
                      </span>
                    </td>
                    <td>
                      {inv.paid_at ? (
                        <div>
                          <div style={{ color: '#fff', fontWeight: 500, fontSize: '12.5px' }}>{formatDate(inv.paid_at)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>💳 {inv.payment_method || 'Cash'}</div>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12.5px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6b7280', display: 'inline-block' }} />
                          Menunggu Bayar
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-cell-group">
                        <a
                          href={createInvoiceWaLink({
                            customerName: customer.name,
                            customerPhone: customer.phone,
                            invoiceNumber: inv.number,
                            period: inv.period,
                            packageName: customer.package_name,
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
                          title="Kirim Tagihan via WhatsApp (wa.me)"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                          </svg>
                          <span>WA</span>
                        </a>

                        <Link href={`/invoices/${inv.id}`} className="btn btn-secondary table-action-btn">
                          Cetak
                        </Link>
                        {inv.status === 'unpaid' && (
                          <form action={payInvoice}>
                            <input type="hidden" name="id" value={inv.id} />
                            <input type="hidden" name="payment_method" value="Cash" />
                            <button type="submit" className="btn btn-success table-action-btn">
                              Bayar
                            </button>
                          </form>
                        )}
                        {inv.status === 'paid' && (
                          <form action={unpayInvoice}>
                            <input type="hidden" name="id" value={inv.id} />
                            <SubmitButton variant="secondary" size="sm" loadingText="Membatalkan...">
                              Batal Lunas
                            </SubmitButton>
                          </form>
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

      {/* Bagian Berhenti / Nonaktif */}
      <div style={{ marginTop: '28px', borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f87171' }}>Status Berlangganan</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            Pelanggan berhenti berlangganan akan otomatis di-disable akunnya di MikroTik.
          </div>
        </div>
        <form action={setInactive}>
          <input type="hidden" name="id" value={customer.id} />
          <input type="hidden" name="inactive" value={customer.status === 'inactive' ? 'false' : 'true'} />
          <SubmitButton variant="danger" size="sm">
            {customer.status === 'inactive' ? '✅ Aktifkan Kembali Langganan' : '⛔ Set Pelanggan Berhenti'}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
