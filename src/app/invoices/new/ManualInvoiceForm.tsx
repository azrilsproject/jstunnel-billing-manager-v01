'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { initialState } from '@/lib/action-state';
import { createManualInvoiceAction } from '@/app/actions/invoices';
import { SubmitButton } from '@/components/SubmitButton';
import { computeSchedule, parseDate, todayStr, periodLabel, addMonths } from '@/lib/dates';
import { rupiah } from '@/lib/format';

export type CustomerOption = {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  pppoe_username: string;
  due_day: number;
  isolir_day: number;
  package_id: number;
  package_name: string;
  price: number;
};

export type PackageOption = {
  id: number;
  name: string;
  price: number;
};

type Props = {
  customers: CustomerOption[];
  packages: PackageOption[];
  defaultCustomerId?: number;
};

export function ManualInvoiceForm({ customers, packages, defaultCustomerId }: Props) {
  const [state, formAction] = useActionState(createManualInvoiceAction, initialState);

  const today = todayStr();
  const { y: curY, m: curM } = parseDate(today);
  const defaultPeriod = `${curY}-${String(curM).padStart(2, '0')}`;

  const [customerId, setCustomerId] = useState<number | ''>(defaultCustomerId || (customers[0]?.id ?? ''));
  const [period, setPeriod] = useState<string>(defaultPeriod);
  const [packageName, setPackageName] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [issueDate, setIssueDate] = useState<string>(today);
  const [dueDate, setDueDate] = useState<string>('');
  const [isolirDate, setIsolirDate] = useState<string>('');
  const [status, setStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [notes, setNotes] = useState<string>('');

  // Selected customer object
  const selectedCust = customers.find((c) => c.id === Number(customerId));

  // Generate period options: past 2 months, current, next 5 months
  const periodOptions: { value: string; label: string }[] = [];
  for (let offset = -2; offset <= 5; offset++) {
    const ym = addMonths(curY, curM, offset);
    const val = `${ym.y}-${String(ym.m).padStart(2, '0')}`;
    const tag = offset === 0 ? ' (Bulan Ini)' : offset === 1 ? ' (Bulan Depan)' : '';
    periodOptions.push({
      value: val,
      label: `${periodLabel(`${val}-01`)}${tag}`,
    });
  }

  // Auto-fill when customer changes
  useEffect(() => {
    if (selectedCust) {
      setPackageName(selectedCust.package_name || '');
      setAmount(selectedCust.price || 0);

      // Recalculate schedule
      const { y, m } = parseDate(period);
      const sched = computeSchedule(y, m, selectedCust.due_day, selectedCust.isolir_day);
      setDueDate(sched.dueDate);
      setIsolirDate(sched.isolirDate);
    }
  }, [customerId, selectedCust]);

  // Recalculate dates when period changes
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    if (selectedCust) {
      const { y, m } = parseDate(newPeriod);
      const sched = computeSchedule(y, m, selectedCust.due_day, selectedCust.isolir_day);
      setDueDate(sched.dueDate);
      setIsolirDate(sched.isolirDate);
    }
  };

  // Quick preset package selection
  const handleQuickPackageSelect = (pkgName: string, pkgPrice: number) => {
    setPackageName(pkgName);
    setAmount(pkgPrice);
  };

  const estimatedInvoiceNumber = selectedCust
    ? `INV-${period.replace('-', '')}-${selectedCust.code}`
    : 'INV-YYYYMM-PLGXXXX';

  return (
    <form action={formAction}>
      {state.message && (
        <div className={`alert ${state.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '24px' }}>
          <span>{state.ok ? '✓' : '⚠️'}</span>
          <span>{state.message}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Kolom Kiri: Form Input */}
        <div className="card">
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '18px' }}>
            Data Pelanggan & Periode Tagihan
          </h2>

          {/* Pilih Pelanggan */}
          <div className="form-group">
            <label className="form-label" htmlFor="customer_id">
              Pilih Pelanggan PPPoE <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              id="customer_id"
              name="customer_id"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
              className="form-select"
              required
            >
              <option value="">-- Pilih Pelanggan --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code} • PPPoE: {c.pppoe_username})
                </option>
              ))}
            </select>
            {state.errors?.customer_id && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>
                {state.errors.customer_id}
              </div>
            )}
            {selectedCust && (
              <div className="form-help">
                No. HP: {selectedCust.phone || '-'} • Siklus jatuh tempo: tgl {selectedCust.due_day} • batas isolir: tgl {selectedCust.isolir_day}
              </div>
            )}
          </div>

          {/* Periode Bulan */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="period">
                Bulan / Periode Tagihan <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                id="period"
                name="period"
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="form-select"
                required
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {state.errors?.period && (
                <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>
                  {state.errors.period}
                </div>
              )}
              <div className="form-help">Periode: {periodLabel(`${period}-01`)}</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="issue_date">
                Tanggal Terbit Invoice
              </label>
              <input
                id="issue_date"
                name="issue_date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="form-input"
                required
              />
              {state.errors?.issue_date && (
                <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>
                  {state.errors.issue_date}
                </div>
              )}
            </div>
          </div>

          {/* Item Tagihan / Paket & Nominal */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
              <label className="form-label" htmlFor="package_name" style={{ margin: 0 }}>
                Nama Paket / Deskripsi Tagihan <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {packages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleQuickPackageSelect(p.name, p.price)}
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                    title={`Pilih paket ${p.name} (${rupiah(p.price)})`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <input
              id="package_name"
              name="package_name"
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="Contoh: Paket Home 20 Mbps / Biaya Pasang Baru"
              className="form-input"
              required
            />
            {state.errors?.package_name && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>
                {state.errors.package_name}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="amount">
              Nominal Tagihan (Rp) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="form-input"
              style={{ fontSize: '16px', fontWeight: 700 }}
              required
            />
            {state.errors?.amount && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>
                {state.errors.amount}
              </div>
            )}
            <div className="form-help">Terbilang: <strong>{rupiah(amount)}</strong></div>
          </div>

          {/* Jadwal Jatuh Tempo & Isolir */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="due_date">
                Tanggal Jatuh Tempo <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="due_date"
                name="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="form-input"
                required
              />
              {state.errors?.due_date && (
                <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>
                  {state.errors.due_date}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="isolir_date">
                Batas Tanggal Isolir <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="isolir_date"
                name="isolir_date"
                type="date"
                value={isolirDate}
                onChange={(e) => setIsolirDate(e.target.value)}
                className="form-input"
                required
              />
              {state.errors?.isolir_date && (
                <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>
                  {state.errors.isolir_date}
                </div>
              )}
            </div>
          </div>

          {/* Status Bayar Awal */}
          <div className="form-group" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label className="form-label">Status Pembayaran Awal</label>
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="status"
                  value="unpaid"
                  checked={status === 'unpaid'}
                  onChange={() => setStatus('unpaid')}
                />
                <span style={{ fontWeight: 600, color: status === 'unpaid' ? '#f59e0b' : 'var(--text-muted)' }}>
                  🟡 Belum Bayar (Unpaid)
                </span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="status"
                  value="paid"
                  checked={status === 'paid'}
                  onChange={() => setStatus('paid')}
                />
                <span style={{ fontWeight: 600, color: status === 'paid' ? '#10b981' : 'var(--text-muted)' }}>
                  🟢 Langsung Lunas (Paid)
                </span>
              </label>
            </div>

            {status === 'paid' && (
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed var(--border)' }}>
                <label className="form-label" htmlFor="payment_method">
                  Metode Pembayaran
                </label>
                <select
                  id="payment_method"
                  name="payment_method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-select"
                >
                  <option value="Cash">Cash / Tunai</option>
                  <option value="Transfer BCA">Transfer BCA</option>
                  <option value="Transfer Mandiri">Transfer Mandiri</option>
                  <option value="Transfer BRI">Transfer BRI</option>
                  <option value="Transfer BNI">Transfer BNI</option>
                  <option value="QRIS">QRIS</option>
                </select>
                <div className="form-help">
                  Layanan pelanggan otomatis dipulihkan jika sebelumnya terisolir.
                </div>
              </div>
            )}
          </div>

          {/* Catatan / Keterangan */}
          <div className="form-group">
            <label className="form-label" htmlFor="notes">
              Catatan / Keterangan Tambahan (Opsional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Tagihan dibayar langsung tunai di kantor, promo potongan biaya pasang, dsb."
              className="form-textarea"
            />
          </div>
        </div>

        {/* Kolom Kanan: Live Preview & Ringkasan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🧾</span>
              <span>Ringkasan Invoice Manual</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Nomor Invoice:</span>
                <span className="font-mono" style={{ fontWeight: 700, color: '#3b82f6' }}>
                  {estimatedInvoiceNumber}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pelanggan:</span>
                <strong style={{ color: 'var(--text-main)', textAlign: 'right' }}>
                  {selectedCust ? selectedCust.name : '-'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>PPPoE Username:</span>
                <code style={{ color: '#059669', fontWeight: 600 }}>{selectedCust ? selectedCust.pppoe_username : '-'}</code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Periode Bulan:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{periodLabel(`${period}-01`)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Item / Paket:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{packageName || '-'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Jatuh Tempo:</span>
                <span className="date-chip date-chip-warning" style={{ fontSize: '11.5px' }}>
                  📅 {dueDate || '-'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Batas Isolir:</span>
                <span className="date-chip date-chip-danger" style={{ fontSize: '11.5px' }}>
                  🛡️ {isolirDate || '-'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status Awal:</span>
                {status === 'paid' ? (
                  <span className="badge badge-paid">
                    <span className="badge-dot" /> Lunas ({paymentMethod})
                  </span>
                ) : (
                  <span className="badge badge-unpaid">
                    <span className="badge-dot" /> Belum Bayar
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Total Tagihan:</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb' }}>
                  {rupiah(amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SubmitButton variant="primary" loadingText="Menerbitkan Invoice...">
                💾 Simpan & Terbitkan Invoice
              </SubmitButton>

              <Link href="/invoices" className="btn btn-secondary" style={{ textAlign: 'center' }}>
                Batal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
