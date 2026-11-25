import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { getCustomer } from '@/lib/billing';
import { query } from '@/lib/db';
import { formatDate, periodLabel } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { getActiveSession } from '@/lib/mikrotik';
import { getRouter, isRouterUsable } from '@/lib/routers';
import { SubmitButton } from '@/components/SubmitButton';
import { EmptyState, Icon, KV, PageHeader, Panel, StatusBadge } from '@/components/ui';
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
  const router = await getRouter(customer.router_id);
  let activeSession: { address: string; uptime: string; callerId: string } | null = null;
  let routerError: string | null = null;
  if (isRouterUsable(router)) {
    try {
      activeSession = await getActiveSession(router, customer.pppoe_username);
    } catch (err) {
      routerError = (err as Error).message;
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

  const WA_PATH = "M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z";

  return (
    <div>
      <PageHeader
        back={{ href: '/customers', label: 'Daftar pelanggan' }}
        title={customer.name}
        badge={
          <>
            <StatusBadge status={customer.status} />
            <span className={`pill ${customer.billing_type === 'postpaid' ? 'pill-blue' : 'pill-green'}`}>
              {customer.billing_type === 'postpaid' ? 'Pascabayar' : 'Prabayar'}
            </span>
          </>
        }
        desc={<><span className="code-tag">{customer.code}</span> · {customer.phone || 'Tanpa nomor HP'}</>}
        actions={
          <>
            <Link href={`/customers/${customer.id}/edit`} className="btn btn-secondary">
              <Icon name="edit" size={15} /> Edit
            </Link>
            <form action={syncNow}>
              <input type="hidden" name="id" value={customer.id} />
              <SubmitButton variant="secondary" loadingText="Sinkronisasi...">
                <Icon name="refresh" size={15} /> Sync Router
              </SubmitButton>
            </form>
            {customer.status === 'active' && (
              <form action={isolateNow}>
                <input type="hidden" name="id" value={customer.id} />
                <SubmitButton variant="danger" loadingText="Mengisolir...">
                  <Icon name="shield" size={15} /> Isolir
                </SubmitButton>
              </form>
            )}
            {customer.status === 'isolated' && (
              <form action={restoreNow}>
                <input type="hidden" name="id" value={customer.id} />
                <SubmitButton variant="success" loadingText="Membuka...">
                  <Icon name="check" size={15} /> Buka Isolir
                </SubmitButton>
              </form>
            )}
            <form action={generateCustomerInvoice}>
              <input type="hidden" name="id" value={customer.id} />
              <SubmitButton variant="primary" loadingText="Membuat...">
                <Icon name="receipt" size={15} /> Buat Invoice Bulan Ini
              </SubmitButton>
            </form>
          </>
        }
      />

      {msg && (
        <div className="banner banner-success">
          <Icon name="check" size={18} />
          <span>{msg}</span>
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <Panel title="Akun & paket">
          <KV label="Paket">{customer.package_name}</KV>
          <KV label="Tarif">{rupiah(customer.price)}/bln</KV>
          <KV label="Username PPPoE"><span className="mono">{customer.pppoe_username}</span></KV>
          <KV label="Password PPPoE"><span className="mono">{customer.pppoe_password}</span></KV>
          <KV label="Router">
            {router ? (
              <Link href={`/routers?router=${router.id}`} style={{ fontWeight: 600 }}>
                {router.name}
                {!router.enabled && <span className="text-warning"> (nonaktif)</span>}
              </Link>
            ) : (
              <span className="text-dim">Tanpa router</span>
            )}
          </KV>
          <KV label="Profil MikroTik">
            {customer.status === 'isolated' ? (
              <span className="text-danger">{router?.isolir_profile ?? 'ISOLIR'} (isolir)</span>
            ) : (
              customer.mikrotik_profile
            )}
          </KV>
        </Panel>

        <Panel title="Jadwal tagihan">
          <KV label="Sistem">{customer.billing_type === 'postpaid' ? 'Pascabayar — ditagih bulan depan' : 'Prabayar — ditagih saat aktif'}</KV>
          <KV label="Tanggal aktif">{formatDate(customer.active_date)}</KV>
          <KV label="Jatuh tempo">Tiap tanggal {customer.due_day}</KV>
          <KV label="Isolir otomatis"><span className="text-danger">Tiap tanggal {customer.isolir_day}</span></KV>
          <KV label="Alamat">{customer.address || '—'}</KV>
        </Panel>

        <Panel title="Sesi PPPoE" sub={router ? router.name : undefined}>
          {!router || !isRouterUsable(router) ? (
            <EmptyState icon="router" title={router ? 'Router nonaktif' : 'Belum ada router'}>
              Pasang atau aktifkan router lewat tombol Edit untuk melihat status online.
            </EmptyState>
          ) : routerError ? (
            <EmptyState icon="alert" title={`Tidak bisa menghubungi ${router.name}`}>{routerError}</EmptyState>
          ) : activeSession ? (
            <>
              <div className="session-online"><span className="badge-dot" style={{ background: '#22c55e' }} /> Online</div>
              <KV label="IP client"><span className="mono">{activeSession.address}</span></KV>
              <KV label="Uptime">{activeSession.uptime}</KV>
              <KV label="Caller ID"><span className="mono">{activeSession.callerId}</span></KV>
            </>
          ) : (
            <EmptyState icon="clock" title="Offline">
              Modem pelanggan mati atau belum dial ke {router.name}.
            </EmptyState>
          )}
        </Panel>
      </div>

      <Panel
        title="Riwayat tagihan"
        sub="Tagihan bulanan dan status pembayaran"
        flush
        action={
          <Link href={`/invoices/new?customerId=${customer.id}`} className="btn btn-secondary btn-sm">
            <Icon name="plus" size={14} /> Invoice baru
          </Link>
        }
      >
        {invoices.length === 0 ? (
          <EmptyState icon="receipt" title="Belum ada invoice">
            Klik “Buat Invoice Bulan Ini” untuk membuat tagihan pertama.
          </EmptyState>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Jumlah</th>
                  <th>Jatuh tempo</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/invoices/${inv.id}`} className="mono" style={{ fontWeight: 600 }}>{inv.number}</Link>
                      <div className="person-sub">{periodLabel(inv.period)}</div>
                    </td>
                    <td><strong>{rupiah(inv.amount)}</strong></td>
                    <td>
                      <div>{formatDate(inv.due_date)}</div>
                      <div className="person-sub">Isolir {formatDate(inv.isolir_date)}</div>
                    </td>
                    <td>
                      <span className={`badge ${inv.status === 'paid' ? 'badge-paid' : inv.status === 'unpaid' ? 'badge-unpaid' : 'badge-void'}`}>
                        <span className="badge-dot" />
                        {inv.status === 'paid' ? 'Lunas' : inv.status === 'unpaid' ? 'Belum bayar' : 'Batal'}
                      </span>
                      {inv.paid_at && (
                        <div className="person-sub">{formatDate(inv.paid_at)} · {inv.payment_method || 'Cash'}</div>
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
                          className="btn btn-wa btn-sm"
                          title="Kirim tagihan via WhatsApp"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="WhatsApp"><path d={WA_PATH} /></svg>
                        </a>
                        <Link href={`/invoices/${inv.id}`} className="btn btn-secondary btn-sm" title="Lihat / cetak invoice" aria-label="Cetak invoice"><Icon name="print" size={14} /></Link>
                        {inv.status === 'unpaid' && (
                          <form action={payInvoice}>
                            <input type="hidden" name="id" value={inv.id} />
                            <input type="hidden" name="payment_method" value="Cash" />
                            <button type="submit" className="btn btn-success btn-sm">Bayar</button>
                          </form>
                        )}
                        {inv.status === 'paid' && (
                          <form action={unpayInvoice}>
                            <input type="hidden" name="id" value={inv.id} />
                            <SubmitButton variant="secondary" size="sm" loadingText="Membatalkan...">Batal lunas</SubmitButton>
                          </form>
                        )}
                        <DeleteConfirmForm action={deleteInvoiceAction} confirmMessage={`Hapus invoice ${inv.number}?`}>
                          <input type="hidden" name="id" value={inv.id} />
                          <button type="submit" className="btn btn-danger btn-sm" title={`Hapus invoice ${inv.number}`}>
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
      </Panel>

      <div className="danger-zone">
        <div>
          <div className="danger-zone-title">Zona berbahaya</div>
          <div className="text-dim" style={{ fontSize: '12.5px' }}>
            {customer.status === 'inactive'
              ? 'Pelanggan berhenti. Aktifkan kembali untuk membuka secret di router.'
              : 'Berhenti berlangganan akan menonaktifkan secret pelanggan di router.'}
          </div>
        </div>
        <div className="action-cell-group">
          <form action={setInactive}>
            <input type="hidden" name="id" value={customer.id} />
            <input type="hidden" name="inactive" value={customer.status === 'inactive' ? 'false' : 'true'} />
            <SubmitButton variant={customer.status === 'inactive' ? 'success' : 'secondary'} size="sm">
              {customer.status === 'inactive' ? 'Aktifkan kembali' : 'Set berhenti berlangganan'}
            </SubmitButton>
          </form>
          <DeleteConfirmForm
            action={deleteCustomerDirect}
            confirmMessage={`Hapus pelanggan "${customer.name}" (${customer.code}) secara permanen?\n\nSemua riwayat tagihan pelanggan ini juga akan ikut terhapus.`}
          >
            <input type="hidden" name="id" value={customer.id} />
            <SubmitButton variant="danger" size="sm" loadingText="Menghapus...">Hapus pelanggan</SubmitButton>
          </DeleteConfirmForm>
        </div>
      </div>
    </div>
  );
}
