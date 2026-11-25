'use client';

import { useActionState } from 'react';
import { saveCompanySettings } from '@/app/actions/settings';
import { changePassword } from '@/app/actions/auth';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';
import { Settings } from '@/lib/settings';

type Props = {
  initialSettings: Settings;
};

export function SettingsClient({ initialSettings }: Props) {
  const [coState, coAction] = useActionState(saveCompanySettings, initialState);
  const [pwState, pwAction] = useActionState(changePassword, initialState);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. Pengaturan Identitas Usaha & Invoice */}
      <div className="card">
        <h2 className="form-section-title">
          Identitas Usaha & Aturan Penagihan
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Informasi ini dicetak pada lembar invoice resmi untuk pelanggan.
        </p>

        {coState.message && (
          <div className={`alert ${coState.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '20px' }}>
            <span>{coState.ok ? '✅' : '⚠️'}</span>
            <span>{coState.message}</span>
          </div>
        )}

        <form action={coAction}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="company_name">
                Nama Usaha / Provider ISP *
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                defaultValue={initialSettings.company_name}
                placeholder="Contoh: JAMES NET"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="company_phone">
                Nomor Kontak / WhatsApp Call Center
              </label>
              <input
                id="company_phone"
                name="company_phone"
                type="text"
                defaultValue={initialSettings.company_phone}
                placeholder="Contoh: 0812-3456-7890"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="company_address">
              Alamat Kantor / Domisili Usaha
            </label>
            <input
              id="company_address"
              name="company_address"
              type="text"
              defaultValue={initialSettings.company_address}
              placeholder="Contoh: Jl. Pahlawan No. 45, Surabaya"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bank_info">
              Informasi Rekening Pembayaran (Ditampilkan di Invoice)
            </label>
            <textarea
              id="bank_info"
              name="bank_info"
              rows={3}
              defaultValue={initialSettings.bank_info}
              placeholder="BCA: 1234567890 a.n. James Net&#10;Mandiri: 9876543210 a.n. James Net"
              className="form-textarea"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="invoice_days_before">
                Terbitkan Invoice H-x Sebelum Jatuh Tempo (Hari)
              </label>
              <input
                id="invoice_days_before"
                name="invoice_days_before"
                type="number"
                min="0"
                max="30"
                defaultValue={initialSettings.invoice_days_before || '7'}
                className="form-input font-mono"
              />
              <div className="form-help">
                Sistem otomatis membuat nomor invoice ketika hari ini memasuki H-x sebelum tanggal jatuh tempo pelanggan.
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
              <label className="form-check">
                <input
                  type="checkbox"
                  name="auto_isolir"
                  defaultChecked={initialSettings.auto_isolir === 'true'}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>
                    Aktifkan Eksekusi Isolir Otomatis
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Jika aktif, sistem otomatis memutus & mengisolir pelanggan yang melewati tanggal isolirnya.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <SubmitButton className="btn-primary">
              Simpan Pengaturan Usaha
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* 4. Ganti Password Admin */}
      <div className="card">
        <h2 className="form-section-title">
          Keamanan Akun Administrator
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
          Ganti password login admin untuk keamanan sistem billing Anda.
        </p>

        {pwState.message && (
          <div className={`alert ${pwState.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '16px' }}>
            <span>{pwState.ok ? '🔑' : '⚠️'}</span>
            <span>{pwState.message}</span>
          </div>
        )}

        <form action={pwAction}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="current_password">
                Password Lama
              </label>
              <input
                id="current_password"
                name="current_password"
                type="password"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new_password">
                Password Baru (Min 6 Karakter)
              </label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm_password">
                Konfirmasi Password Baru
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                className="form-input"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <SubmitButton variant="secondary">
              Perbarui Password
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
