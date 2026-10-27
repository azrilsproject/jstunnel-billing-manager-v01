'use client';

import { useActionState } from 'react';
import { saveCompanySettings, saveMikrotikSettings, testMikrotikConnectionAction } from '@/app/actions/settings';
import { changePassword } from '@/app/actions/auth';
import { importFromMikrotik } from '@/app/actions/customers';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';
import { Settings } from '@/lib/settings';
import { MikrotikScriptGenerator } from '@/components/MikrotikScriptGenerator';

type Props = {
  initialSettings: Settings;
};

export function SettingsClient({ initialSettings }: Props) {
  const [coState, coAction] = useActionState(saveCompanySettings, initialState);
  const [mkState, mkAction] = useActionState(saveMikrotikSettings, initialState);
  const [testState, testAction] = useActionState(testMikrotikConnectionAction, initialState);
  const [importState, importAction] = useActionState(importFromMikrotik, initialState);
  const [pwState, pwAction] = useActionState(changePassword, initialState);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. Pengaturan Identitas Usaha & Invoice */}
      <div className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
          🏢 Identitas Usaha & Aturan Penagihan
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
              💾 Simpan Pengaturan Usaha
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* 2. Integrasi RouterOS MikroTik */}
      <div className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
          📡 Koneksi Router MikroTik (API Port 8728 / 8729)
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Hubungkan sistem ke MikroTik untuk isolir otomatis, perubahan profile PPP, dan kick session realtime.
        </p>

        {mkState.message && (
          <div className={`alert ${mkState.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '20px' }}>
            <span>{mkState.ok ? '✅' : '⚠️'}</span>
            <span>{mkState.message}</span>
          </div>
        )}

        <form action={mkAction}>
          <div style={{ marginBottom: '20px' }}>
            <label className="form-check">
              <input
                type="checkbox"
                name="mikrotik_enabled"
                defaultChecked={initialSettings.mikrotik_enabled === 'true'}
              />
              <div>
                <strong style={{ color: '#fff' }}>Aktifkan Integrasi MikroTik API</strong>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Jika dimatikan, sistem billing tetap berjalan normal sebagai pencatatan tagihan dan isolir internal.
                </div>
              </div>
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="mikrotik_host">
                Host / IP Router MikroTik *
              </label>
              <input
                id="mikrotik_host"
                name="mikrotik_host"
                type="text"
                defaultValue={initialSettings.mikrotik_host}
                placeholder="192.168.88.1 atau domain.vpn.id"
                className="form-input font-mono"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mikrotik_port">
                Port API (Default: 8728)
              </label>
              <input
                id="mikrotik_port"
                name="mikrotik_port"
                type="number"
                defaultValue={initialSettings.mikrotik_port || '8728'}
                className="form-input font-mono"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="mikrotik_user">
                User API MikroTik *
              </label>
              <input
                id="mikrotik_user"
                name="mikrotik_user"
                type="text"
                defaultValue={initialSettings.mikrotik_user}
                placeholder="admin_billing"
                className="form-input font-mono"
              />
              <div className="form-help">Pastikan user MikroTik memiliki akses grup full atau read/write.</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mikrotik_password">
                Password API MikroTik
              </label>
              <input
                id="mikrotik_password"
                name="mikrotik_password"
                type="password"
                defaultValue={initialSettings.mikrotik_password}
                placeholder="••••••••"
                className="form-input font-mono"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="isolir_profile" style={{ color: '#f87171' }}>
                🛡️ Nama Profile Isolir di MikroTik *
              </label>
              <input
                id="isolir_profile"
                name="isolir_profile"
                type="text"
                required
                defaultValue={initialSettings.isolir_profile || 'ISOLIR'}
                placeholder="ISOLIR"
                className="form-input font-mono"
              />
              <div className="form-help">
                Nama profil di menu <code>/ppp/profile</code> MikroTik yang diatur untuk pelanggan nunggak/isolir.
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
              <label className="form-check">
                <input
                  type="checkbox"
                  name="mikrotik_tls"
                  defaultChecked={initialSettings.mikrotik_tls === 'true'}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>
                    Gunakan Koneksi Aman TLS (Port 8729)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Centang jika MikroTik Anda mengaktifkan api-ssl.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <SubmitButton className="btn-primary">
              💾 Simpan Konfigurasi Router
            </SubmitButton>
          </div>
        </form>

        {/* Form Tes Koneksi Realtime */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>
            Tes Koneksi Router Realtime
          </h3>

          {testState.message && (
            <div className={`alert ${testState.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '14px' }}>
              <span>{testState.ok ? '📡' : '❌'}</span>
              <span style={{ fontSize: '13px' }}>{testState.message}</span>
            </div>
          )}

          <form action={testAction} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input type="hidden" name="mikrotik_host" value={initialSettings.mikrotik_host} />
            <input type="hidden" name="mikrotik_port" value={initialSettings.mikrotik_port} />
            <input type="hidden" name="mikrotik_user" value={initialSettings.mikrotik_user} />
            <input type="hidden" name="mikrotik_password" value={initialSettings.mikrotik_password} />
            <input type="hidden" name="mikrotik_tls" value={initialSettings.mikrotik_tls} />
            <SubmitButton variant="secondary" size="sm" loadingText="Menguji koneksi...">
              🔌 Uji Koneksi ke Router Sekarang
            </SubmitButton>
          </form>
        </div>

        {/* Generator Script Isolir MikroTik ROS 6 & ROS 7 */}
        <MikrotikScriptGenerator defaultProfile={initialSettings.isolir_profile || 'ISOLIR'} />
      </div>

      {/* 3. Import PPPoE Secret dari MikroTik */}
      <div className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
          📥 Impor Secret PPPoE dari MikroTik
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Tarik otomatis semua akun PPPoE yang sudah ada di router MikroTik Anda ke dalam sistem billing ini.
        </p>

        {importState.message && (
          <div className={`alert ${importState.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '16px' }}>
            <span>{importState.ok ? '📥' : '⚠️'}</span>
            <span>{importState.message}</span>
          </div>
        )}

        <form action={importAction}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="due_day">
                Tentukan Default Jatuh Tempo Tiap Bulan (1–31)
              </label>
              <input
                id="due_day"
                name="due_day"
                type="number"
                min="1"
                max="31"
                required
                defaultValue="10"
                className="form-input font-mono"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="isolir_day">
                Tentukan Default Tanggal Isolir Tiap Bulan (1–31)
              </label>
              <input
                id="isolir_day"
                name="isolir_day"
                type="number"
                min="1"
                max="31"
                required
                defaultValue="15"
                className="form-input font-mono"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SubmitButton variant="secondary" loadingText="Mengimpor secret...">
              📥 Tarik PPPoE dari Router
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* 4. Ganti Password Admin */}
      <div className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
          🔒 Keamanan Akun Administrator
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
              🔑 Perbarui Password
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
