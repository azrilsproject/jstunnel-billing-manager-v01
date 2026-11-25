'use client';

import { useState, useActionState } from 'react';
import { savePackage, deletePackage } from '@/app/actions/packages';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';
import { rupiah } from '@/lib/format';
import { EmptyState, Icon } from '@/components/ui';

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
            <Icon name="plus" size={16} /> Tambah Paket
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
                Tutup
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

      {/* Kartu paket */}
      {initialPackages.length === 0 ? (
        <section className="panel">
          <EmptyState icon="bolt" title="Belum ada paket">
            Buat paket pertama (tarif + profile PPP) agar bisa dipilih saat menambah pelanggan.
          </EmptyState>
        </section>
      ) : (
        <div className="pkg-grid">
          {initialPackages.map((pkg) => (
            <article key={pkg.id} className="pkg-card">
              <div className="pkg-head">
                <div>
                  <h3 className="pkg-name">{pkg.name}</h3>
                  {pkg.speed && <span className="pill pill-blue">{pkg.speed}</span>}
                </div>
                <div className="pkg-price">
                  {rupiah(pkg.price)}
                  <span>/bln</span>
                </div>
              </div>
              {pkg.description && <p className="pkg-desc">{pkg.description}</p>}
              <div className="pkg-meta">
                <span className="code-tag" title="Profile PPP di MikroTik">{pkg.mikrotik_profile}</span>
                <span className="text-muted" style={{ fontSize: '12.5px' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{pkg.customer_count}</strong> pelanggan
                </span>
              </div>
              <div className="pkg-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(pkg);
                    setShowAdd(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  <Icon name="edit" size={14} /> Edit
                </button>
                {pkg.customer_count === 0 ? (
                  <form
                    action={delAction}
                    onSubmit={(e) => {
                      if (!confirm(`Hapus paket "${pkg.name}"?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={pkg.id} />
                    <SubmitButton variant="danger" size="sm">Hapus</SubmitButton>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="btn btn-danger btn-sm"
                    title={`Paket "${pkg.name}" masih dipakai ${pkg.customer_count} pelanggan. Pindahkan pelanggannya dulu.`}
                  >
                    Hapus
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
