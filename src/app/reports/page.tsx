import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { formatDate, formatDateTime, monthOptions, periodLabel, todayStr } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { ReportPrintButton } from '@/components/ReportPrintButton';

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
  await verifySession();
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
    billing_type: 'prepaid' | 'postpaid';
    admin_name: string | null;
  }>(`
    SELECT 
      i.id, i.number, i.period, i.package_name, i.amount,
      i.issue_date, i.due_date, i.isolir_date, i.status,
      i.paid_at, i.payment_method,
      c.id AS customer_id, c.name AS customer_name, c.code AS customer_code,
      c.phone AS customer_phone, c.pppoe_username, c.billing_type,
      a.name AS admin_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN admins a ON a.id = i.paid_by
    WHERE ${where}
    ORDER BY (CASE WHEN i.paid_at IS NOT NULL THEN i.paid_at ELSE i.created_at END) DESC
  `, params);

  // Perhitungan Ringkasan / Metrik KPI
  let totalGross = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  let totalVoid = 0;

  let paidCount = 0;
  let unpaidCount = 0;
  let voidCount = 0;

  // Breakdown metode bayar
  const methodMap: Record<string, { count: number; total: number }> = {};
  // Breakdown paket
  const packageMap: Record<string, { count: number; total: number; paidCount: number; paidTotal: number }> = {};
  // Breakdown sistem tagihan
  let prepaidCount = 0;
  let prepaidPaid = 0;
  let postpaidCount = 0;
  let postpaidPaid = 0;

  for (const inv of invoices) {
    totalGross += inv.amount;

    if (inv.status === 'paid') {
      totalPaid += inv.amount;
      paidCount++;

      const m = inv.payment_method || 'Lainnya / Tidak Tercatat';
      if (!methodMap[m]) methodMap[m] = { count: 0, total: 0 };
      methodMap[m].count++;
      methodMap[m].total += inv.amount;

      if (inv.billing_type === 'postpaid') {
        postpaidPaid += inv.amount;
      } else {
        prepaidPaid += inv.amount;
      }
    } else if (inv.status === 'unpaid') {
      totalUnpaid += inv.amount;
      unpaidCount++;
    } else if (inv.status === 'void') {
      totalVoid += inv.amount;
      voidCount++;
    }

    if (inv.billing_type === 'postpaid') {
      postpaidCount++;
    } else {
      prepaidCount++;
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

  return (
    <div>
      {/* 1. Header (Hidden on Print) */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">📈 Laporan Keuangan & Penagihan</h1>
          <p className="page-desc">
            Rekapitulasi pendapatan kas masuk, piutang tertunggak, sebaran paket, dan rincian transaksi.
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ReportPrintButton />
          <a
            href={exportUrl}
            className="btn btn-secondary"
            download
            title="Download laporan transaksi dalam format file CSV / Excel"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <span>📥</span>
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* 2. Filter Bar (Hidden on Print) */}
      <div className="card no-print" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <form method="GET" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>
              Periode Bulan
            </label>
            <select name="period" defaultValue={period} className="form-select" style={{ minWidth: '170px' }}>
              <option value="">Semua Periode</option>
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>
              Status Tagihan
            </label>
            <select name="status" defaultValue={status} className="form-select" style={{ minWidth: '140px' }}>
              <option value="">Semua Status</option>
              <option value="paid">✅ Lunas</option>
              <option value="unpaid">⏳ Belum Bayar</option>
              <option value="void">🚫 Batal</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>
              Metode Pembayaran
            </label>
            <select name="method" defaultValue={method} className="form-select" style={{ minWidth: '150px' }}>
              <option value="">Semua Metode</option>
              <option value="Cash">Cash / Tunai</option>
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="Transfer Mandiri">Transfer Mandiri</option>
              <option value="Transfer BRI">Transfer BRI</option>
              <option value="QRIS">QRIS</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>
              Sistem Tagihan
            </label>
            <select name="billing_type" defaultValue={billingType} className="form-select" style={{ minWidth: '140px' }}>
              <option value="">Semua Tipe</option>
              <option value="prepaid">⚡ Prabayar</option>
              <option value="postpaid">📅 Pascabayar</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>
              Pencarian
            </label>
            <input
              name="q"
              type="text"
              defaultValue={q}
              placeholder="Cari invoice / pelanggan..."
              className="form-input"
              style={{ width: '180px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end', marginTop: 'auto' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
              🔍 Tampilkan
            </button>
            {(period !== defaultPeriod || status || method || billingType || q) && (
              <Link href="/reports" className="btn btn-secondary" style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                Reset
              </Link>
            )}
          </div>
        </form>
      </div>

      {/* 3. Lembar Kop Resmi Laporan (Muncul Khusus Saat Print) */}
      <div className="report-print-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '14px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {settings.company_name || 'JAMES NET'}
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
              {settings.company_address || 'Penyedia Layanan Internet & Jaringan PPPoE'}
            </div>
            {settings.company_phone && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Kontak: {settings.company_phone}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
              LAPORAN KEUANGAN & PENAGIHAN
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#2563eb', marginTop: '2px' }}>
              Periode: {currentPeriodTitle}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Dicetak pada: {formatDate(today)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. KPI Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        {/* Kas Masuk */}
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            💰
          </div>
          <div className="stat-title">Kas Masuk (Lunas)</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            {rupiah(totalPaid)}
          </div>
          <div className="stat-sub">
            <strong>{paidCount}</strong> transaksi lunas
          </div>
        </div>

        {/* Piutang Tertunggak */}
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            ⏳
          </div>
          <div className="stat-title">Piutang (Belum Bayar)</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            {rupiah(totalUnpaid)}
          </div>
          <div className="stat-sub">
            <strong>{unpaidCount}</strong> tagihan belum selesai
          </div>
        </div>

        {/* Total Terbit (Gross) */}
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            📊
          </div>
          <div className="stat-title">Total Tagihan Terbit</div>
          <div className="stat-value">
            {rupiah(totalGross)}
          </div>
          <div className="stat-sub">
            <strong>{invoices.length}</strong> invoice periode ini
          </div>
        </div>

        {/* Tingkat Ketagihan */}
        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
            🎯
          </div>
          <div className="stat-title">Tingkat Kolektibilitas</div>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>
            {collectionRate}%
          </div>
          <div className="stat-sub">
            {voidCount > 0 ? `${voidCount} invoice dibatalkan` : 'Persentase keberhasilan bayar'}
          </div>
        </div>
      </div>

      {/* 5. Breakdown Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Breakdown Metode Pembayaran */}
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        {/* Breakdown Paket Internet & Tipe Tagihan */}
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📦</span>
            <span>Rincian Paket & Model Tagihan</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Box Prabayar vs Pascabayar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '4px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>⚡ Prabayar</div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>{rupiah(prepaidPaid)}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{prepaidCount} tagihan ({prepaidPaid > 0 ? `${Math.round((prepaidPaid/totalPaid)*100)}% kas` : '0%'})</div>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>📅 Pascabayar</div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>{rupiah(postpaidPaid)}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{postpaidCount} tagihan ({postpaidPaid > 0 ? `${Math.round((postpaidPaid/totalPaid)*100)}% kas` : '0%'})</div>
              </div>
            </div>

            {/* List Paket Teratas */}
            {Object.entries(packageMap).map(([pkgName, pkgData]) => (
              <div key={pkgName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>{pkgName}</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{pkgData.paidCount}/{pkgData.count} lunas</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#10b981' }}>{rupiah(pkgData.paidTotal)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>potensi: {rupiah(pkgData.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Tabel Rincian Transaksi */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
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

      {/* 7. Kolom Tanda Tangan Cetak (Muncul Khusus Saat Print) */}
      <div className="report-print-signature">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', padding: '0 30px' }}>
          <div style={{ textAlign: 'center', width: '220px' }}>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '60px' }}>
              Mengetahui,<br />Pimpinan / Direktur
            </div>
            <div style={{ borderBottom: '1px solid #334155', fontWeight: 700, paddingBottom: '4px' }}>
              ( ........................................ )
            </div>
          </div>

          <div style={{ textAlign: 'center', width: '220px' }}>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '60px' }}>
              Dibuat Oleh,<br />Staff Keuangan & Kasir
            </div>
            <div style={{ borderBottom: '1px solid #334155', fontWeight: 700, paddingBottom: '4px' }}>
              ( ........................................ )
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
