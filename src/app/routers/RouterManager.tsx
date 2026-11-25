'use client';

import { useActionState, useTransition } from 'react';
import Link from 'next/link';
import {
  deleteRouter,
  moveCustomersBetweenRouters,
  saveRouter,
  setDefaultRouter,
  testRouterAction,
  toggleRouterEnabled,
} from '@/app/actions/routers';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';
import type { RouterSummary } from '@/lib/routers';

export type RouterRow = RouterSummary & {
  customer_total: number;
  customer_active: number;
  customer_isolated: number;
};

type Props = {
  routers: RouterRow[];
  /** id router terpilih, atau 'new' untuk form tambah */
  selected: number | 'new' | null;
  unassigned: number;
};

export function RouterManager({ routers, selected, unassigned }: Props) {
  const current = typeof selected === 'number' ? routers.find((r) => r.id === selected) ?? null : null;
  const isNew = selected === 'new' || (!current && routers.length === 0);

  return (
    <div className="router-manager">
      {/* Daftar router (switcher) */}
      <nav className="router-list" aria-label="Daftar router">
        {routers.map((r) => (
          <Link
            key={r.id}
            href={`/routers?router=${r.id}`}
            scroll={false}
            className={`router-item ${current?.id === r.id ? 'is-active' : ''}`}
            aria-current={current?.id === r.id ? 'page' : undefined}
          >
            <div className="router-item-title">
              <span className="badge-dot" style={{ background: r.enabled ? '#10b981' : '#94a3b8' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              {r.is_default && <span className="router-pill router-pill-default">Default</span>}
            </div>
            <div className="router-item-host">
              {r.host}:{r.port}
              {r.tls ? ' • TLS' : ''}
            </div>
            <div className="router-item-stats">
              <span>{r.customer_total}</span>
              <span style={{ color: '#34d399' }}>● {r.customer_active}</span>
              <span style={{ color: '#f87171' }}>{r.customer_isolated}</span>
            </div>
          </Link>
        ))}
        <Link
          href="/routers?router=new"
          scroll={false}
          className={`router-item router-item-add ${isNew ? 'is-active' : ''}`}
        >
          + Tambah Router
        </Link>
        {unassigned > 0 && (
          <div style={{ fontSize: '12px', color: '#fbbf24', padding: '4px 2px' }}>
            {unassigned} pelanggan belum dipasangkan ke router.
          </div>
        )}
      </nav>

      {/* Panel detail router terpilih */}
      <div className="router-panel">
        {isNew ? (
          <RouterForm key="new" router={null} />
        ) : current ? (
          <RouterDetail key={current.id} router={current} others={routers.filter((r) => r.id !== current.id)} unassigned={unassigned} />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Pilih salah satu router.</div>
        )}
      </div>
    </div>
  );
}

function RouterDetail({ router, others, unassigned }: { router: RouterRow; others: RouterRow[]; unassigned: number }) {
  const [moveState, moveAction] = useActionState(moveCustomersBetweenRouters, initialState);

  return (
    <>
      <div className="router-panel-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{router.name}</h3>
            <span className={`router-pill ${router.enabled ? 'router-pill-on' : 'router-pill-off'}`}>
              {router.enabled ? '● Aktif' : '○ Nonaktif'}
            </span>
            {router.is_default && <span className="router-pill router-pill-default">Default pelanggan baru</span>}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <code className="font-mono">{router.host}:{router.port}</code> • {router.customer_total} pelanggan •{' '}
            <Link href={`/customers?router=${router.id}`} style={{ color: 'var(--primary)' }}>
              Lihat pelanggan →
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!router.is_default && (
            <form action={setDefaultRouter}>
              <input type="hidden" name="id" value={router.id} />
              <SubmitButton variant="secondary" size="sm" loadingText="...">
                Jadikan Default
              </SubmitButton>
            </form>
          )}
          <form action={toggleRouterEnabled}>
            <input type="hidden" name="id" value={router.id} />
            <SubmitButton variant={router.enabled ? 'secondary' : 'success'} size="sm" loadingText="...">
              {router.enabled ? '⏸ Nonaktifkan' : '▶ Aktifkan'}
            </SubmitButton>
          </form>
        </div>
      </div>

      <RouterForm router={router} />

      {/* Pindahkan pelanggan massal */}
      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '18px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
          Pindahkan Pelanggan Massal
        </h4>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Ubah router pelanggan di database sekaligus (mis. saat migrasi NAS). Secret di router tidak diubah — gunakan tombol
          Sync di detail pelanggan bila perlu dibuat di router baru.
        </p>
        {moveState.message && (
          <div className={`alert ${moveState.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '12px' }}>
            <span>{moveState.ok ? '✅' : '⚠️'}</span>
            <span>{moveState.message}</span>
          </div>
        )}
        <form action={moveAction} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select name="from" defaultValue={String(router.id)} className="form-select" style={{ maxWidth: '230px' }}>
            <option value={router.id}>Dari: {router.name} ({router.customer_total})</option>
            {unassigned > 0 && <option value="none">Dari: Tanpa router ({unassigned})</option>}
            {others.map((r) => (
              <option key={r.id} value={r.id}>
                Dari: {r.name} ({r.customer_total})
              </option>
            ))}
          </select>
          <span style={{ color: 'var(--text-dim)' }}>→</span>
          <select name="to" defaultValue={others[0]?.id ?? router.id} className="form-select" style={{ maxWidth: '230px' }}>
            <option value={router.id}>Ke: {router.name}</option>
            {others.map((r) => (
              <option key={r.id} value={r.id}>
                Ke: {r.name}
              </option>
            ))}
            <option value="">Ke: Tanpa router</option>
          </select>
          <SubmitButton variant="secondary" size="sm" loadingText="Memindahkan...">
            Pindahkan
          </SubmitButton>
        </form>
      </div>

      {/* Hapus router */}
      <div className="router-danger">
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>Hapus Router</h4>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Konfigurasi router dihapus dari sistem billing. {router.customer_total} pelanggan di router ini akan dipindahkan ke
          router pilihan di bawah. Secret PPPoE di MikroTik tidak disentuh.
        </p>
        <DeleteConfirmForm
          action={deleteRouter}
          confirmMessage={`Hapus router "${router.name}"?\n\n${router.customer_total} pelanggan akan dipindahkan ke router yang dipilih.`}
        >
          <input type="hidden" name="id" value={router.id} />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select name="move_to" defaultValue={others.find((r) => r.is_default)?.id ?? others[0]?.id ?? ''} className="form-select" style={{ maxWidth: '260px' }}>
              {others.map((r) => (
                <option key={r.id} value={r.id}>
                  Pindahkan pelanggan ke: {r.name}
                </option>
              ))}
              <option value="">Lepas pelanggan (tanpa router)</option>
            </select>
            <button type="submit" className="btn btn-danger btn-sm">
              Hapus Router
            </button>
          </div>
        </DeleteConfirmForm>
      </div>
    </>
  );
}

function RouterForm({ router }: { router: RouterRow | null }) {
  const [saveState, saveAction, savePending] = useActionState(saveRouter, initialState);
  const [testState, testAction, testPending] = useActionState(testRouterAction, initialState);
  const [, startTransition] = useTransition();
  const busy = savePending || testPending;
  const err = saveState.errors ?? {};

  // Submit manual (bukan form action) agar isian tidak di-reset React setelah tes / gagal validasi
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(e.currentTarget);
    const run = submitter?.dataset.intent === 'test' ? testAction : saveAction;
    startTransition(() => run(fd));
  }

  return (
    <>
      {!router && (
        <div style={{ marginBottom: '18px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>+ Tambah Router Baru</h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Daftarkan router MikroTik (NAS) lain. Setiap pelanggan bisa dipasangkan ke router yang berbeda.
          </p>
        </div>
      )}

      {saveState.message && (
        <div className={`alert ${saveState.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '16px' }}>
          <span>{saveState.ok ? '✅' : '⚠️'}</span>
          <span>{saveState.message}</span>
        </div>
      )}
      {testState.message && (
        <div className={`alert ${testState.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '16px' }}>
          <span>{testState.ok ? '📡' : '❌'}</span>
          <span style={{ fontSize: '13px' }}>{testState.message}</span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        {router && <input type="hidden" name="id" value={router.id} />}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="r_name">Nama Router *</label>
            <input id="r_name" name="name" type="text" required defaultValue={router?.name ?? ''} placeholder="Contoh: POP Merpati / NAS-2" className="form-input" />
            {err.name && <FieldError msg={err.name} />}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="r_isolir">Profile Isolir di Router Ini *</label>
            <input id="r_isolir" name="isolir_profile" type="text" required defaultValue={router?.isolir_profile ?? 'ISOLIR'} className="form-input font-mono" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="r_host">Host / IP Router *</label>
            <input id="r_host" name="host" type="text" required defaultValue={router?.host ?? ''} placeholder="192.168.88.1 atau domain.vpn.id" className="form-input font-mono" />
            {err.host && <FieldError msg={err.host} />}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="r_port">Port API</label>
            <input id="r_port" name="port" type="number" min="1" max="65535" defaultValue={router?.port ?? 8728} className="form-input font-mono" />
            {err.port && <FieldError msg={err.port} />}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="r_user">User API *</label>
            <input id="r_user" name="username" type="text" required defaultValue={router?.username ?? ''} placeholder="admin_billing" className="form-input font-mono" autoComplete="off" />
            {err.username && <FieldError msg={err.username} />}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="r_pass">Password API</label>
            <input
              id="r_pass"
              name="password"
              type="password"
              placeholder={router?.has_password ? '•••••••• (kosongkan jika tidak diubah)' : '••••••••'}
              className="form-input font-mono"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="r_notes">Catatan (Opsional)</label>
          <input id="r_notes" name="notes" type="text" defaultValue={router?.notes ?? ''} placeholder="Lokasi, area layanan, dsb." className="form-input" />
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '6px 0 18px' }}>
          <label className="form-check">
            <input type="checkbox" name="enabled" defaultChecked={router?.enabled ?? true} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Router aktif</span>
          </label>
          <label className="form-check">
            <input type="checkbox" name="tls" defaultChecked={router?.tls ?? false} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Gunakan TLS (api-ssl 8729)</span>
          </label>
          {!router?.is_default && (
            <label className="form-check">
              <input type="checkbox" name="is_default" defaultChecked={false} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Jadikan default pelanggan baru</span>
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="submit" data-intent="test" className="btn btn-secondary" disabled={busy}>
            {testPending ? 'Menguji koneksi...' : '🔌 Uji Koneksi'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {savePending ? 'Menyimpan...' : `💾 ${router ? 'Simpan Perubahan' : 'Tambah Router'}`}
          </button>
        </div>
      </form>
    </>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{msg}</div>;
}
