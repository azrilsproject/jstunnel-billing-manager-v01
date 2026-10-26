import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { queryOne } from '@/lib/db';
import { formatDateLong, periodLabel } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { payInvoice, unpayInvoice, cancelInvoiceAction, deleteInvoiceAction } from '@/app/actions/invoices';
import { SubmitButton } from '@/components/SubmitButton';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';
import { PrintButton } from './PrintButton';
import { createInvoiceWaLink } from '@/lib/whatsapp';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: Props) {
  await verifySession();
  const { id } = await params;
  const invoiceId = parseInt(id, 10);
  if (!invoiceId) notFound();

  const invoice = await queryOne<{
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
    notes: string | null;
    customer_id: number;
    customer_name: string;
    customer_code: string;
    customer_address: string | null;
    customer_phone: string | null;
    pppoe_username: string;
    customer_active_date: string;
    package_speed: string | null;
  }>(`
    SELECT 
      i.*,
      c.id AS customer_id, c.name AS customer_name, c.code AS customer_code,
      c.address AS customer_address, c.phone AS customer_phone,
      c.pppoe_username, c.active_date AS customer_active_date,
      p.speed AS package_speed
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN packages p ON p.id = c.package_id
    WHERE i.id = $1
  `, [invoiceId]);

  if (!invoice) notFound();
  const settings = await getSettings();

  const waLink = createInvoiceWaLink({
    customerName: invoice.customer_name,
    customerPhone: invoice.customer_phone,
    invoiceNumber: invoice.number,
    period: invoice.period,
    packageName: invoice.package_name,
    amount: invoice.amount,
    dueDate: invoice.due_date,
    isolirDate: invoice.isolir_date,
    status: invoice.status,
    companyName: settings.company_name,
    bankInfo: settings.bank_info,
  });

  return (
    <div>
      {/* Action Bar (Hanya tampil di layar, tidak terprint) */}
      <div className="no-print" style={{ maxWidth: '820px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <Link href="/invoices" className="btn btn-secondary btn-sm">
          ← Kembali ke Daftar Invoice
        </Link>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            style={{
              background: '#25D366',
              color: '#ffffff',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.4)',
            }}
          >
            <span>💬</span>
            <span>Kirim via WhatsApp (wa.me)</span>
          </a>

          <PrintButton />

          {invoice.status === 'unpaid' && (
            <form action={payInvoice} style={{ display: 'inline-flex', gap: '8px' }}>
              <input type="hidden" name="id" value={invoice.id} />
              <select name="payment_method" className="form-select" style={{ padding: '6px 10px', fontSize: '13px' }}>
                <option value="Cash">Cash / Tunai</option>
                <option value="Transfer BCA">Transfer BCA</option>
                <option value="Transfer Mandiri">Transfer Mandiri</option>
                <option value="Transfer BRI">Transfer BRI</option>
                <option value="QRIS">QRIS</option>
              </select>
              <SubmitButton variant="success" size="sm">
                ✅ Tandai Lunas
              </SubmitButton>
            </form>
          )}

          {invoice.status === 'paid' && (
            <form action={unpayInvoice}>
              <input type="hidden" name="id" value={invoice.id} />
              <SubmitButton variant="secondary" size="sm">
                Batal Lunas
              </SubmitButton>
            </form>
          )}

          {invoice.status === 'unpaid' && (
            <DeleteConfirmForm action={cancelInvoiceAction} confirmMessage="Batalkan invoice ini?">
              <input type="hidden" name="id" value={invoice.id} />
              <SubmitButton variant="secondary" size="sm">
                Batalkan
              </SubmitButton>
            </DeleteConfirmForm>
          )}

          <DeleteConfirmForm
            action={deleteInvoiceAction}
            confirmMessage={`Hapus invoice ${invoice.number} secara permanen? Data yang terhapus tidak dapat dikembalikan.`}
          >
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="redirect_to" value="/invoices" />
            <SubmitButton variant="danger" size="sm">
              🗑️ Hapus Invoice
            </SubmitButton>
          </DeleteConfirmForm>
        </div>
      </div>

      {/* Lembar Invoice Resmi (Printable Paper) */}
      <div className="invoice-paper">
        {/* Header Perusahaan & Judul Invoice */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e5e7eb', paddingBottom: '24px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.5px' }}>
              {settings.company_name || 'JAMES NET'}
            </div>
            <div style={{ fontSize: '12.5px', color: '#4b5563', marginTop: '4px', maxWidth: '300px' }}>
              {settings.company_address || 'Penyedia Layanan Internet & Jaringan PPPoE'}
            </div>
            {settings.company_phone && (
              <div style={{ fontSize: '12.5px', color: '#4b5563', marginTop: '2px' }}>
                Kontak: {settings.company_phone}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', textTransform: 'uppercase' }}>
              INVOICE
            </div>
            <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
              {invoice.number}
            </div>
            <div style={{ marginTop: '10px' }}>
              {invoice.status === 'paid' ? (
                <span style={{ display: 'inline-block', padding: '6px 14px', background: '#dcfce7', color: '#15803d', border: '2px solid #86efac', borderRadius: '6px', fontWeight: 800, fontSize: '14px', letterSpacing: '1px' }}>
                  LUNAS
                </span>
              ) : invoice.status === 'unpaid' ? (
                <span style={{ display: 'inline-block', padding: '6px 14px', background: '#fef3c7', color: '#b45309', border: '2px solid #fde68a', borderRadius: '6px', fontWeight: 800, fontSize: '14px', letterSpacing: '1px' }}>
                  BELUM BAYAR
                </span>
              ) : (
                <span style={{ display: 'inline-block', padding: '6px 14px', background: '#f3f4f6', color: '#6b7280', border: '2px solid #d1d5db', borderRadius: '6px', fontWeight: 800, fontSize: '14px' }}>
                  DIBATALKAN
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Informasi Tagihan & Pelanggan */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px', marginBottom: '6px' }}>
              Ditagihkan Kepada:
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              {invoice.customer_name}
            </div>
            <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>
              Kode: <strong>{invoice.customer_code}</strong> • User PPPoE: <code>{invoice.pppoe_username}</code>
            </div>
            {invoice.customer_address && (
              <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '4px' }}>
                Alamat: {invoice.customer_address}
              </div>
            )}
            {invoice.customer_phone && (
              <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>
                Telepon: {invoice.customer_phone}
              </div>
            )}
          </div>

          <div style={{ background: '#f9fafb', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>Periode Tagihan:</span>
              <strong style={{ color: '#111827' }}>{periodLabel(invoice.period)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>Tanggal Terbit:</span>
              <span>{formatDateLong(invoice.issue_date)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>Jatuh Tempo:</span>
              <strong style={{ color: '#b45309' }}>{formatDateLong(invoice.due_date)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>Tanggal Isolir Layanan:</span>
              <strong style={{ color: '#dc2626' }}>{formatDateLong(invoice.isolir_date)}</strong>
            </div>
          </div>
        </div>

        {/* Tabel Rincian Biaya */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', color: '#374151', fontSize: '12px' }}>No.</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', color: '#374151', fontSize: '12px' }}>Deskripsi Layanan</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', color: '#374151', fontSize: '12px' }}>Kecepatan</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', color: '#374151', fontSize: '12px' }}>Periode</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', color: '#374151', fontSize: '12px' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '16px 14px', color: '#6b7280' }}>1</td>
              <td style={{ padding: '16px 14px' }}>
                <div style={{ fontWeight: 700, color: '#111827' }}>Langganan Internet PPPoE ({invoice.package_name})</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  Aktivasi sejak: {formatDateLong(invoice.customer_active_date)}
                </div>
              </td>
              <td style={{ padding: '16px 14px', textAlign: 'center', color: '#374151' }}>
                {invoice.package_speed || 'Standar'}
              </td>
              <td style={{ padding: '16px 14px', textAlign: 'center', color: '#374151' }}>
                1 Bulan
              </td>
              <td style={{ padding: '16px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                {rupiah(invoice.amount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Total & Info Rekening Pembayaran */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
          <div style={{ background: '#f9fafb', padding: '16px 18px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '6px' }}>
              Metode Pembayaran:
            </div>
            <div style={{ fontSize: '13px', color: '#1f2937', whiteSpace: 'pre-line' }}>
              {settings.bank_info || 'Silakan hubungi administrator untuk instruksi pembayaran.'}
            </div>
            <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '10px', fontStyle: 'italic' }}>
              * Mohon selesaikan pembayaran sebelum tanggal isolir ({formatDateLong(invoice.isolir_date)}) agar layanan internet tetap aktif.
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13.5px', color: '#6b7280' }}>
              <span>Total Tagihan:</span>
              <strong style={{ fontSize: '18px', color: '#1e3a8a' }}>{rupiah(invoice.amount)}</strong>
            </div>

            {invoice.paid_at && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#047857', fontWeight: 700 }}>
                  TELAH DIBAYAR PADA:
                </div>
                <div style={{ fontSize: '13px', color: '#065f46', marginTop: '2px' }}>
                  {formatDateLong(invoice.paid_at)} via {invoice.payment_method || 'Cash'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Invoice */}
        <div style={{ marginTop: '40px', borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
          <div>Terima kasih atas kepercayaan Anda menggunakan layanan kami.</div>
          <div>Dicetak secara otomatis oleh sistem JAMES BILLING</div>
        </div>
      </div>
    </div>
  );
}
