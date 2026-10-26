'use client';

import { useState, useActionState } from 'react';
import { savePackage, deletePackage } from '@/app/actions/packages';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';
import { rupiah } from '@/lib/format';

type Package = {
  id: number;
  name: string;
  price: number;
  mikrotik_profile: string;
  speed: string | null;
  description: string | null;
  customer_count: number;
};

type Props = {
  initialPackages: Package[];
};

export function PackageList({ initialPackages }: Props) {
  const [saveState, saveAction] = useActionState(savePackage, initialState);
  const [delState, delAction] = useActionState(deletePackage, initialState);

  const [editing, setEditing] = useState<Package | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      {(saveState.message || delState.message) && (
        <div
          className={`alert ${saveState.ok || delState.ok ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: '20px' }}
        >
          <span>{saveState.ok || delState.ok ? '✅' : '⚠️'}</span>
          <span>{saveState.message || delState.message}</span>
        </div>
      )}

      {/* Tombol Tambah & Form Tambah/Edit */}
      <div style={{ marginBottom: '24px' }}>
        {!showAdd && !editing && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="btn btn-primary"
          >
            + Tambah Paket Baru
          </button>
        )}

        {(showAdd || editing) && (
          <div className="card" style={{ maxWidth: '680px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                {editing ? `Edit Paket: ${editing.name}` : 'Tambah Paket Internet Baru'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setEditing(null);
                }}
                className="btn btn-secondary btn-sm"
              >
                ✕ Tutup
              </button>
            </div>

            <form action={saveAction} onSubmit={() => { setShowAdd(false); setEditing(null); }}>
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="name">
                    Nama Paket *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    defaultValue={editing?.name || ''}
                    placeholder="Contoh: Paket Family 20M"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="price">
                    Harga Tagihan Bulanan (Rp) *
                  </label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="1000"
                    required
                    defaultValue={editing?.price || 150000}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="mikrotik_profile">
                    Nama Profile MikroTik *
                  </label>
                  <input
                    id="mikrotik_profile"
                    name="mikrotik_profile"
                    type="text"
                    required
                    defaultValue={editing?.mikrotik_profile || ''}
                    placeholder="Contoh: HOME-20M"
                    className="form-input font-mono"
                  />
                  <div className="form-help">
                    Harus sama persis dengan nama profile di menu <code>/ppp/profile</code> MikroTik.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="speed">
                    Kecepatan (Label Tampilan)
                  </label>
                  <input
                    id="speed"
                    name="speed"
                    type="text"
                    defaultValue={editing?.speed || ''}
                    placeholder="Contoh: 20 Mbps"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="description">
                  Keterangan / Deskripsi
                </label>
                <input
                  id="description"
                  name="description"
                  type="text"
                  defaultValue={editing?.description || ''}
                  placeholder="Contoh: Cocok untuk 3-5 perangkat"
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setEditing(null);
                  }}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <SubmitButton className="btn-primary">
                  {editing ? 'Simpan Perubahan' : 'Tambahkan Paket'}
                </SubmitButton>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Tabel Paket */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nama Paket</th>
              <th>Tarif Bulanan</th>
              <th>Profile MikroTik</th>
              <th>Kecepatan</th>
              <th>Pelanggan Aktif</th>
              <th>Keterangan</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {initialPackages.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                  Belum ada paket langganan. Klik &quot;Tambah Paket Baru&quot; di atas.
                </td>
              </tr>
            ) : (
              initialPackages.map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <strong style={{ color: '#fff', fontSize: '14.5px' }}>{pkg.name}</strong>
                  </td>
                  <td>
                    <strong style={{ color: '#34d399', fontSize: '14px' }}>{rupiah(pkg.price)}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}> /bln</span>
                  </td>
                  <td>
                    <code className="font-mono" style={{ color: '#a78bfa', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                      {pkg.mikrotik_profile}
                    </code>
                  </td>
                  <td>
                    <span style={{ color: '#fff' }}>{pkg.speed || '-'}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: pkg.customer_count > 0 ? '#60a5fa' : 'var(--text-dim)' }}>
                      {pkg.customer_count} Pelanggan
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {pkg.description || '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(pkg);
                          setShowAdd(false);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        Edit
                      </button>

                      {pkg.customer_count === 0 ? (
                        <form
                          action={delAction}
                          onSubmit={(e) => {
                            if (!confirm(`Hapus paket "${pkg.name}"?`)) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="id" value={pkg.id} />
                          <SubmitButton variant="danger" size="sm">
                            Hapus
                          </SubmitButton>
                        </form>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="btn btn-danger btn-sm"
                          style={{ opacity: 0.45, cursor: 'not-allowed' }}
                          title={`Paket "${pkg.name}" tidak dapat dihapus karena masih digunakan oleh ${pkg.customer_count} pelanggan. Silakan ubah paket pelanggan terlebih dahulu.`}
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
