import Link from 'next/link';
import { StatTile } from '@/components/ui';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { formatDate, formatDateTime, monthOptions, periodLabel, todayStr } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { ReportViewContainer } from '@/components/ReportViewContainer';

type Props = {
  searchParams: Promise<{
    period?: string;
    status?: string;
    method?: string;
    billing_type?: string;
    q?: string;
  }>;
};

export default async function ReportsPage({ searchParams }: Props) {
  const session = await verifySession();
  const sp = await searchParams;

  const today = todayStr();
  const [currentY, currentM] = today.split('-').map(Number);
  const defaultPeriod = `${currentY}-${String(currentM).padStart(2, '0')}`;

  const period = sp.period !== undefined ? sp.period : defaultPeriod;
  const status = sp.status || '';
  const method = sp.method || '';
  const billingType = sp.billing_type || '';
  const q = sp.q || '';

  const periods = monthOptions(currentY, currentM, 18, 2);

  let where = '1=1';
  const params: unknown[] = [];

  if (period) {
    params.push(period + '-01');
    where += ` AND i.period = $${params.length}`;
  }

  if (status && ['paid', 'unpaid', 'void'].includes(status)) {
    params.push(status);
    where += ` AND i.status = $${params.length}`;
  }

  if (method) {
    params.push(method);
    where += ` AND i.payment_method = $${params.length}`;
  }

  if (billingType && ['prepaid', 'postpaid'].includes(billingType)) {
    params.push(billingType);
    where += ` AND c.billing_type = $${params.length}`;
  }

  if (q) {
    params.push(`%${q}%`);
    where += ` AND (i.number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.code ILIKE $${params.length} OR c.pppoe_username ILIKE $${params.length})`;
  }

  const invoices = await query<{
    id: number;
    number: string;
    status: 'paid' | 'unpaid' | 'void';
    period: string;
    package_name: string;
    amount: number;
    issue_date: string;
    due_date: string;
    paid_at: string | null;
    payment_method: string | null;
    customer_id: number;
    customer_name: string;
    customer_code: string;
    pppoe_username: string;
    billing_type: 'prepaid' | 'postpaid';
    admin_name: string | null;
  }>(`
    SELECT 
      i.id, i.number, i.status, i.period, i.package_name, i.amount,
      i.issue_date, i.due_date, i.paid_at, i.payment_method,
      c.id AS customer_id, c.name AS customer_name, c.code AS customer_code,
      c.pppoe_username, c.billing_type,
      a.name AS admin_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN admins a ON a.id = i.paid_by
    WHERE ${where}
    ORDER BY (CASE WHEN i.paid_at IS NOT NULL THEN i.paid_at ELSE i.created_at END) DESC
  `, params);

  const settings = await getSettings();

  // Hitung Agregat Finansial
  let totalPaid = 0;
  let paidCount = 0;
  let totalUnpaid = 0;
  let unpaidCount = 0;
  let totalGross = 0;
  let voidCount = 0;

  let prepaidPaid = 0;
  let prepaidCount = 0;
  let postpaidPaid = 0;
  let postpaidCount = 0;

  const methodMap: Record<string, { count: number; total: number }> = {};
  const packageMap: Record<string, { count: number; total: number; paidCount: number; paidTotal: number }> = {};

  for (const inv of invoices) {
    totalGross += inv.amount;

    if (inv.status === 'paid') {
      totalPaid += inv.amount;
      paidCount++;

      const m = inv.payment_method || 'Lainnya';
      if (!methodMap[m]) methodMap[m] = { count: 0, total: 0 };
      methodMap[m].count++;
      methodMap[m].total += inv.amount;

      if (inv.billing_type === 'prepaid') {
        prepaidPaid += inv.amount;
        prepaidCount++;
      } else {
        postpaidPaid += inv.amount;
        postpaidCount++;
      }
    } else if (inv.status === 'unpaid') {
      totalUnpaid += inv.amount;
      unpaidCount++;
    } else if (inv.status === 'void') {
      voidCount++;
    }

    const pkg = inv.package_name || 'Lainnya';
    if (!packageMap[pkg]) packageMap[pkg] = { count: 0, total: 0, paidCount: 0, paidTotal: 0 };
    packageMap[pkg].count++;
    packageMap[pkg].total += inv.amount;
    if (inv.status === 'paid') {
      packageMap[pkg].paidCount++;
      packageMap[pkg].paidTotal += inv.amount;
    }
  }

  const collectionRate = totalGross > 0 ? Math.round((totalPaid / totalGross) * 100) : 0;

  // URL ekspor CSV dengan filter yang sama
  const exportParams = new URLSearchParams();
  if (period) exportParams.set('period', period);
  if (status) exportParams.set('status', status);
  if (method) exportParams.set('method', method);
  if (billingType) exportParams.set('billing_type', billingType);
  const exportUrl = `/api/reports/export?${exportParams.toString()}`;

  const currentPeriodTitle = period ? periodLabel(period + '-01') : 'Semua Periode';
  const filterStatusLabel = status
    ? status === 'paid'
      ? 'Khusus Lunas'
      : status === 'unpaid'
      ? 'Khusus Belum Bayar'
      : 'Khusus Batal'
    : 'Semua Status';
  const filterMethodLabel = method || 'Semua Metode';
  const filterTypeLabel = billingType
    ? billingType === 'prepaid'
      ? '⚡ Prabayar'
      : '📅 Pascabayar'
    : 'Semua Model';

  // ==========================================
  // VIEW 1: INTERACTIVE SCREEN CONTENT
  // ==========================================
  const screenContent = (
    <div>
      {/* Filter Bar */}
      <section className="panel" style={{ marginBottom: '20px' }}>
        <form method="GET" className="filter-grid">
          <label className="filter-field">
            <span className="form-label">Periode</span>
            <select name="period" defaultValue={period} className="form-select">
              <option value="">Semua periode</option>
              {periods.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span className="form-label">Status</span>
            <select name="status" defaultValue={status} className="form-select">
              <option value="">Semua status</option>
              <option value="paid">Lunas</option>
              <option value="unpaid">Belum bayar</option>
              <option value="void">Batal</option>
            </select>
          </label>
          <label className="filter-field">
            <span className="form-label">Metode bayar</span>
            <select name="method" defaultValue={method} className="form-select">
              <option value="">Semua metode</option>
              <option value="Cash">Cash / Tunai</option>
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="Transfer Mandiri">Transfer Mandiri</option>
              <option value="Transfer BRI">Transfer BRI</option>
              <option value="QRIS">QRIS</option>
            </select>
          </label>
          <label className="filter-field">
            <span className="form-label">Sistem tagihan</span>
            <select name="billing_type" defaultValue={billingType} className="form-select">
              <option value="">Semua tipe</option>
              <option value="prepaid">Prabayar</option>
              <option value="postpaid">Pascabayar</option>
            </select>
          </label>
          <label className="filter-field">
            <span className="form-label">Cari</span>
            <input name="q" type="text" defaultValue={q} placeholder="Invoice / pelanggan…" className="form-input" />
          </label>
          <div className="filter-actions">
            <button type="submit" className="btn btn-primary">Tampilkan</button>
            {(period !== defaultPeriod || status || method || billingType || q) && (
              <Link href="/reports" className="btn btn-secondary text-muted">Reset</Link>
            )}
          </div>
        </form>
      </section>

      {/* KPI Summary */}
      <div className="stats-grid">
        <StatTile label="Kas masuk (lunas)" value={rupiah(totalPaid)} sub={`${paidCount} transaksi lunas`} icon="wallet" tone="green" />
        <StatTile label="Piutang" value={rupiah(totalUnpaid)} sub={`${unpaidCount} tagihan belum selesai`} icon="clock" tone="amber" />
        <StatTile label="Total tagihan terbit" value={rupiah(totalGross)} sub={`${invoices.length} invoice`} icon="receipt" tone="blue" />
        <StatTile
          label="Kolektibilitas"
          value={`${collectionRate}%`}
          sub={voidCount > 0 ? `${voidCount} invoice dibatalkan` : 'Persentase pembayaran masuk'}
          icon="check"
          tone="violet"
        />
      </div>

      {/* Breakdown Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Metode Bayar */}
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💳</span>
            <span>Rincian Berdasarkan Metode Bayar</span>
          </h2>

          {Object.keys(methodMap).length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              Belum ada pembayaran yang masuk pada periode ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(methodMap).map(([mName, mData]) => {
                const percent = totalPaid > 0 ? Math.round((mData.total / totalPaid) * 100) : 0;
                return (
                  <div key={mName} style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{mName}</strong>
                      <span style={{ fontWeight: 700, color: '#10b981', fontSize: '13.5px' }}>
                        {rupiah(mData.total)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-dim)' }}>
                      <span>{mData.count} transaksi lunas</span>
                      <span>{percent}% dari kas masuk</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Model Tagihan & Paket */}
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📦</span>
            <span>Rincian Paket & Model Tagihan</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '4px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>⚡ Prabayar</div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>{rupiah(prepaidPaid)}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{prepaidCount} tagihan ({totalPaid > 0 ? `${Math.round((prepaidPaid/totalPaid)*100)}% kas` : '0%'})</div>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>📅 Pascabayar</div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>{rupiah(postpaidPaid)}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{postpaidCount} tagihan ({totalPaid > 0 ? `${Math.round((postpaidPaid/totalPaid)*100)}% kas` : '0%'})</div>
              </div>
            </div>

            {Object.entries(packageMap).map(([pkgName, pkgData]) => (
              <div key={pkgName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>{pkgName}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{pkgData.paidCount} lunas dari {pkgData.count} invoice</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#10b981' }}>{rupiah(pkgData.paidTotal)}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Gross: {rupiah(pkgData.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabel Interaktif */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Daftar Rincian Transaksi ({invoices.length} Data)
            </h2>
            <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Periode: <strong>{currentPeriodTitle}</strong>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Tanggal Bayar</th>
                <th>Pelanggan</th>
                <th>Paket & Tipe</th>
                <th>Metode Bayar</th>
                <th>Petugas</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                    Tidak ada transaksi invoice yang sesuai dengan filter ini.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-mono"
                        style={{ color: '#2563eb', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}
                      >
                        {inv.number}
                      </Link>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                        Jatuh tempo: {formatDate(inv.due_date)}
                      </div>
                    </td>

                    <td>
                      {inv.paid_at ? (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{formatDate(inv.paid_at)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{formatDateTime(inv.paid_at).slice(-5)} WIB</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>-</span>
                      )}
                    </td>

                    <td>
                      <div>
                        <Link
                          href={`/customers/${inv.customer_id}`}
                          style={{ fontWeight: 700, color: 'var(--text-main)', textDecoration: 'none' }}
                        >
                          {inv.customer_name}
                        </Link>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                          {inv.customer_code} • <code className="font-mono">{inv.pppoe_username}</code>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600 }}>{inv.package_name}</span>
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            background: inv.billing_type === 'postpaid' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: inv.billing_type === 'postpaid' ? '#2563eb' : '#059669',
                          }}
                        >
                          {inv.billing_type === 'postpaid' ? 'Pasca' : 'Pra'}
                        </span>
                      </div>
                    </td>

                    <td>
                      {inv.payment_method ? (
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>
                          {inv.payment_method}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>-</span>
                      )}
                    </td>

                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {inv.admin_name || '-'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${inv.status === 'paid' ? 'badge-paid' : inv.status === 'unpaid' ? 'badge-unpaid' : 'badge-void'}`}>
                        <span className="badge-dot" />
                        {inv.status === 'paid' ? 'Lunas' : inv.status === 'unpaid' ? 'Belum Bayar' : 'Batal'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '13.5px', color: inv.status === 'paid' ? '#10b981' : inv.status === 'unpaid' ? '#f59e0b' : 'var(--text-dim)' }}>
                      {rupiah(inv.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // VIEW 2: FORMAL A4 PRINTABLE DOCUMENT SHEET
  // ==========================================
  const printContent = (
    <div className="report-print-sheet">
      {/* Kop Surat Formal */}
      <div className="report-kop">
        <div>
          <div className="report-kop-brand">
            {settings.company_name || 'JAMES NET'}
          </div>
          <div className="report-kop-desc">
            {settings.company_address || 'Penyedia Jasa Layanan Internet (ISP) & Manajemen Jaringan PPPoE'}
          </div>
          {settings.company_phone && (
            <div className="report-kop-contact">
              Kontak Layanan: {settings.company_phone}
            </div>
          )}
        </div>

        <div className="report-kop-meta">
          <div className="report-kop-title">
            LAPORAN KEUANGAN & REALISASI PENAGIHAN
          </div>
          <div className="report-kop-subtitle">
            Periode: {currentPeriodTitle}
          </div>
          <div className="report-kop-info">
            Filter: {filterStatusLabel} • {filterTypeLabel} • {filterMethodLabel}
          </div>
          <div className="report-kop-info">
            Dicetak: {formatDate(today)} • Oleh: <strong>{session.name}</strong>
          </div>
        </div>
      </div>

      {/* Ringkasan Finansial Eksekutif */}
      <div className="report-summary-grid">
        <div className="report-summary-box">
          <div className="report-summary-title">Kas Masuk (Lunas)</div>
          <div className="report-summary-val" style={{ color: '#15803d' }}>
            {rupiah(totalPaid)}
          </div>
          <div className="report-summary-sub">
            {paidCount} transaksi berhasil dibayar
          </div>
        </div>

        <div className="report-summary-box">
          <div className="report-summary-title">Piutang Tertunggak</div>
          <div className="report-summary-val" style={{ color: '#b45309' }}>
            {rupiah(totalUnpaid)}
          </div>
          <div className="report-summary-sub">
            {unpaidCount} tagihan belum dibayar
          </div>
        </div>

        <div className="report-summary-box">
          <div className="report-summary-title">Total Tagihan Terbit</div>
          <div className="report-summary-val">
            {rupiah(totalGross)}
          </div>
          <div className="report-summary-sub">
            {invoices.length} total invoice periode ini
          </div>
        </div>

        <div className="report-summary-box">
          <div className="report-summary-title">Tingkat Kolektibilitas</div>
          <div className="report-summary-val" style={{ color: '#1d4ed8' }}>
            {collectionRate}%
          </div>
          <div className="report-summary-sub">
            {voidCount > 0 ? `${voidCount} invoice dibatalkan` : 'Persentase keberhasilan bayar'}
          </div>
        </div>
      </div>

      {/* Rincian Operasional Bar */}
      <div className="report-breakdown-bar">
        <div className="report-breakdown-col">
          <div className="report-breakdown-title">Realisasi per Metode Pembayaran:</div>
          <div className="report-breakdown-items">
            {Object.keys(methodMap).length === 0 ? (
              <span style={{ color: '#64748b' }}>Belum ada penerimaan kas.</span>
            ) : (
              Object.entries(methodMap).map(([mName, mData]) => (
                <span key={mName} className="report-breakdown-item">
                  • {mName}: <strong>{rupiah(mData.total)}</strong> ({mData.count} trx)
                </span>
              ))
            )}
          </div>
        </div>

        <div className="report-breakdown-col" style={{ maxWidth: '380px' }}>
          <div className="report-breakdown-title">Realisasi per Model Berlangganan:</div>
          <div className="report-breakdown-items">
            <span className="report-breakdown-item">
              ⚡ Prabayar: <strong>{rupiah(prepaidPaid)}</strong> ({prepaidCount} trx)
            </span>
            <span className="report-breakdown-item">
              📅 Pascabayar: <strong>{rupiah(postpaidPaid)}</strong> ({postpaidCount} trx)
            </span>
          </div>
        </div>
      </div>

      {/* Tabel Transaksi Formal Buku Kas */}
      <table className="report-table-print">
        <thead>
          <tr>
            <th style={{ width: '28px', textAlign: 'center' }}>No</th>
            <th style={{ width: '100px', textAlign: 'left' }}>No. Invoice</th>
            <th style={{ width: '75px', textAlign: 'left' }}>Tgl Terbit</th>
            <th style={{ width: '75px', textAlign: 'left' }}>Tgl Bayar</th>
            <th style={{ textAlign: 'left' }}>Pelanggan</th>
            <th style={{ width: '90px', textAlign: 'left' }}>User PPPoE</th>
            <th style={{ width: '95px', textAlign: 'left' }}>Paket</th>
            <th style={{ width: '55px', textAlign: 'center' }}>Model</th>
            <th style={{ width: '85px', textAlign: 'left' }}>Metode</th>
            <th style={{ width: '75px', textAlign: 'left' }}>Kasir</th>
            <th style={{ width: '65px', textAlign: 'center' }}>Status</th>
            <th style={{ width: '95px', textAlign: 'right' }}>Nominal (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={12} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                Tidak ada data invoice yang sesuai dengan kriteria filter.
              </td>
            </tr>
          ) : (
            invoices.map((inv, index) => (
              <tr key={inv.id}>
                <td style={{ textAlign: 'center', color: '#64748b' }}>{index + 1}</td>
                <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{inv.number}</td>
                <td>{formatDate(inv.issue_date)}</td>
                <td>{inv.paid_at ? formatDate(inv.paid_at) : '-'}</td>
                <td>
                  <strong>{inv.customer_name}</strong>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>{inv.customer_code}</div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '9.5px' }}>{inv.pppoe_username}</td>
                <td>{inv.package_name}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`print-badge ${inv.billing_type === 'prepaid' ? 'print-badge-prepaid' : 'print-badge-postpaid'}`}>
                    {inv.billing_type === 'prepaid' ? 'Pra' : 'Pasca'}
                  </span>
                </td>
                <td>{inv.payment_method || '-'}</td>
                <td style={{ color: '#475569' }}>{inv.admin_name || '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`print-badge ${inv.status === 'paid' ? 'print-badge-paid' : inv.status === 'unpaid' ? 'print-badge-unpaid' : 'print-badge-void'}`}>
                    {inv.status === 'paid' ? 'Lunas' : inv.status === 'unpaid' ? 'Belum' : 'Batal'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {rupiah(inv.amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={10} style={{ textAlign: 'right', textTransform: 'uppercase' }}>
              Total Kas Masuk (Lunas):
            </td>
            <td colSpan={2} style={{ textAlign: 'right', color: '#15803d' }}>
              {rupiah(totalPaid)}
            </td>
          </tr>
          {totalUnpaid > 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: 'right', textTransform: 'uppercase' }}>
                Total Piutang (Belum Bayar):
              </td>
              <td colSpan={2} style={{ textAlign: 'right', color: '#b45309' }}>
                {rupiah(totalUnpaid)}
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={10} style={{ textAlign: 'right', textTransform: 'uppercase' }}>
              Grand Total Tagihan Terbit (Gross):
            </td>
            <td colSpan={2} style={{ textAlign: 'right', fontSize: '11px', color: '#0f172a' }}>
              {rupiah(totalGross)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Lembar Tanda Tangan Resmi Pengesahan */}
      <div className="report-signatures-wrapper">
        <div className="report-sig-col">
          <div className="report-sig-role">
            Mengetahui,<br />
            <strong>Pimpinan / Direktur Operasional</strong>
          </div>
          <div className="report-sig-line">
            ( .................................................... )
          </div>
          <div className="report-sig-meta">
            Tanggal: .......................................
          </div>
        </div>

        <div className="report-sig-col">
          <div className="report-sig-role">
            Dibuat & Diverifikasi Oleh,<br />
            <strong>Staff Keuangan & Kasir</strong>
          </div>
          <div className="report-sig-line">
            ( {session.name} )
          </div>
          <div className="report-sig-meta">
            Tanggal: {formatDate(today)}
          </div>
        </div>
      </div>

      <div className="report-footer-note">
        Dokumen ini dibuat dan dicetak secara sah melalui Sistem Manajemen Jaringan & Billing Terpusat {settings.company_name || 'JAMES NET'}.
      </div>
    </div>
  );

  return (
    <ReportViewContainer
      screenContent={screenContent}
      printContent={printContent}
      exportUrl={exportUrl}
    />
  );
}
