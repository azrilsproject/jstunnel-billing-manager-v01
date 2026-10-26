'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateCustomer, deleteCustomer } from '@/app/actions/customers';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';
import { CustomerWithPackage } from '@/lib/billing';
import { rupiah } from '@/lib/format';

type Package = {
  id: number;
  name: string;
  price: number;
  speed: string | null;
  mikrotik_profile: string;
};

type Props = {
  customer: CustomerWithPackage;
  packages: Package[];
};

export function CustomerEditForm({ customer, packages }: Props) {
  const [state, formAction] = useActionState(updateCustomer, initialState);
  const [deleteState, deleteAction] = useActionState(deleteCustomer, initialState);

  return (
    <div>
      <div className="card" style={{ marginBottom: '28px' }}>
        {state.message && (
          <div className="alert alert-error" style={{ marginBottom: '24px' }}>
            <span>⚠️</span>
            <span>{state.message}</span>
          </div>
        )}

        <form action={formAction}>
          <input type="hidden" name="id" value={customer.id} />

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
                defaultValue={customer.name}
                className="form-input"
              />
              {state.errors?.name && (
                <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{state.errors.name}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone">
                Nomor WhatsApp / HP
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={customer.phone || ''}
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
              defaultValue={customer.address || ''}
              className="form-input"
            />
          </div>

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
                defaultValue={customer.pppoe_username}
                className="form-input font-mono"
              />
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
                defaultValue={customer.pppoe_password}
                className="form-input font-mono"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="package_id">
              Pilihan Paket Layanan *
            </label>
            <select id="package_id" name="package_id" defaultValue={customer.package_id} required className="form-select">
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {rupiah(p.price)}/bln ({p.speed || 'Profil: ' + p.mikrotik_profile})
                </option>
              ))}
            </select>
          </div>

          <div style={{ margin: '32px 0 20px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              3. Tanggal Aktif & Jadwal Isolir Bulanan
            </h2>
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
                defaultValue={customer.active_date.slice(0, 10)}
                className="form-input"
              />
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
                defaultValue={customer.due_day}
                className="form-input font-mono"
              />
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
                defaultValue={customer.isolir_day}
                className="form-input font-mono"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="notes">
              Catatan Tambahan
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={customer.notes || ''}
              className="form-textarea"
            />
          </div>

          <div
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '28px',
            }}
          >
            <label className="form-check">
              <input type="checkbox" name="sync_mikrotik" defaultChecked />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>
                  Perbarui secret di MikroTik secara bersamaan
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Jika username, password, atau profil paket berubah, perubahan akan langsung di-push ke RouterOS.
                </div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Link href={`/customers/${customer.id}`} className="btn btn-secondary">
              Batal
            </Link>
            <SubmitButton className="btn-primary" loadingText="Menyimpan...">
              💾 Simpan Perubahan
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* Bagian Hapus Pelanggan */}
      <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>
          Zona Bahaya: Hapus Pelanggan
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Tindakan ini akan menghapus data pelanggan dan riwayat tagihannya dari sistem secara permanen.
        </p>

        {deleteState.message && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            <span>⚠️</span>
            <span>{deleteState.message}</span>
          </div>
        )}

        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!confirm(`Yakin ingin menghapus pelanggan "${customer.name}"?`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={customer.id} />
          <div style={{ marginBottom: '14px' }}>
            <label className="form-check">
              <input type="checkbox" name="remove_secret" defaultChecked />
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                Hapus juga akun secret PPPoE dari router MikroTik
              </span>
            </label>
          </div>

          <SubmitButton variant="danger" loadingText="Menghapus...">
            🗑️ Hapus Pelanggan Permanen
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
