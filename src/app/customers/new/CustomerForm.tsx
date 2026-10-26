'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createCustomer } from '@/app/actions/customers';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';
import { rupiah } from '@/lib/format';

type Package = {
  id: number;
  name: string;
  price: number;
  speed: string | null;
  mikrotik_profile: string;
};

type Props = {
  packages: Package[];
  defaultActiveDate: string;
  defaultDueDay: number;
  defaultIsolirDay: number;
};

export function CustomerForm({ packages, defaultActiveDate, defaultDueDay, defaultIsolirDay }: Props) {
  const [state, formAction] = useActionState(createCustomer, initialState);

  return (
    <div className="card">
      {state.message && (
        <div className="alert alert-error" style={{ marginBottom: '24px' }}>
          <span>⚠️</span>
          <span>{state.message}</span>
        </div>
      )}

      <form action={formAction}>
        {/* Bagian 1: Data Identitas Pelanggan */}
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
          1. Data Diri & Lokasi
        </h2>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              Nama Lengkap Pelanggan *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Contoh: Budi Santoso"
              className="form-input"
            />
            {state.errors?.name && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{state.errors.name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              Nomor WhatsApp / HP
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Contoh: 08123456789"
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="address">
            Alamat Pemasangan
          </label>
          <input
            id="address"
            name="address"
            type="text"
            placeholder="Contoh: Jl. Merpati Blok B No. 12 RT 03/04"
            className="form-input"
          />
        </div>

        {/* Bagian 2: Kredensial PPPoE MikroTik */}
        <div style={{ margin: '32px 0 20px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
            2. Akun PPPoE MikroTik & Paket Internet
          </h2>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pppoe_username">
              Username PPPoE *
            </label>
            <input
              id="pppoe_username"
              name="pppoe_username"
              type="text"
              required
              placeholder="budi_merpati12"
              className="form-input font-mono"
            />
            <div className="form-help">Username yang akan disetting pada router ONT/CPE pelanggan.</div>
            {state.errors?.pppoe_username && (
              <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{state.errors.pppoe_username}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pppoe_password">
              Password PPPoE *
            </label>
            <input
              id="pppoe_password"
              name="pppoe_password"
              type="text"
              required
              defaultValue="123456"
              className="form-input font-mono"
            />
            <div className="form-help">Password akun PPPoE pelanggan.</div>
            {state.errors?.pppoe_password && (
              <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{state.errors.pppoe_password}</div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="package_id">
            Pilihan Paket Layanan *
          </label>
          <select id="package_id" name="package_id" required className="form-select">
            <option value="">-- Pilih Paket Internet --</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {rupiah(p.price)}/bln ({p.speed || 'Profil: ' + p.mikrotik_profile})
              </option>
            ))}
          </select>
          {state.errors?.package_id && (
            <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{state.errors.package_id}</div>
          )}
        </div>

        {/* Bagian 3: Siklus Tagihan, Tanggal Aktif & Tanggal Isolir */}
        <div style={{ margin: '32px 0 20px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
            3. Tanggal Aktif & Jadwal Isolir Bulanan
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Aturan tanggal isolir berlaku otomatis per pelanggan setiap bulannya.
          </p>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="active_date">
              Tanggal Mulai Aktif *
            </label>
            <input
              id="active_date"
              name="active_date"
              type="date"
              required
              defaultValue={defaultActiveDate}
              className="form-input"
            />
            <div className="form-help">Tanggal aktivasi pemasangan internet pertama kali.</div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="due_day">
              Tanggal Jatuh Tempo Tiap Bulan (1–31) *
            </label>
            <input
              id="due_day"
              name="due_day"
              type="number"
              min="1"
              max="31"
              required
              defaultValue={defaultDueDay}
              className="form-input font-mono"
            />
            <div className="form-help">Batas akhir pembayaran tagihan rutin per bulan.</div>
            {state.errors?.due_day && (
              <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{state.errors.due_day}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="isolir_day" style={{ color: '#f87171' }}>
              🛡️ Tanggal Isolir Tiap Bulan (1–31) *
            </label>
            <input
              id="isolir_day"
              name="isolir_day"
              type="number"
              min="1"
              max="31"
              required
              defaultValue={defaultIsolirDay}
              className="form-input font-mono"
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}
            />
            <div className="form-help">
              Jika belum lunas pada tanggal ini, akun otomatis diisolir ke profil ISOLIR di MikroTik.
            </div>
            {state.errors?.isolir_day && (
              <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{state.errors.isolir_day}</div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="notes">
            Catatan Tambahan (Opsional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="Contoh: Nomor ODP 04, Port 3, Redaman -19 dBm"
            className="form-textarea"
          />
        </div>

        {/* Opsi Otomatisasi */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <label className="form-check">
            <input type="checkbox" name="sync_mikrotik" defaultChecked />
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>
                Otomatis buat secret di router MikroTik
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Jika integrasi MikroTik aktif, sistem akan langsung mendaftarkan secret PPPoE dengan profil paket ini.
              </div>
            </div>
          </label>

          <label className="form-check">
            <input type="checkbox" name="create_invoice" defaultChecked />
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>
                Generate invoice tagihan bulan berjalan sekarang
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Langsung terbitkan nomor invoice bulan ini sehingga siap dicetak atau ditagihkan.
              </div>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Link href="/customers" className="btn btn-secondary">
            Batal
          </Link>
          <SubmitButton className="btn-primary" loadingText="Menyimpan & Menghubungkan...">
            💾 Simpan Pelanggan
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
