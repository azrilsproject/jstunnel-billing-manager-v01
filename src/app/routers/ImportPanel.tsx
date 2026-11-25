'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { importFromMikrotik } from '@/app/actions/customers';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/SubmitButton';
import { RouterSelect, RouterOption } from '@/components/RouterSelect';

export function ImportPanel({ routers, selectedId }: { routers: RouterOption[]; selectedId: number | null }) {
  const [state, action] = useActionState(importFromMikrotik, initialState);

  if (routers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📡</div>
        <div className="empty-state-title">Belum ada router</div>
        <p>Tambahkan router dulu, baru akun PPPoE-nya bisa ditarik ke billing.</p>
        <Link href="/routers?router=new" className="btn btn-primary">+ Tambah Router</Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="section-title">📥 Impor Secret PPPoE dari Router</h2>
      <p className="section-desc">
        Tarik semua akun PPPoE yang sudah ada di router. Pelanggan hasil impor otomatis terpasang ke router tersebut.
        Akun yang profilnya belum cocok dengan paket akan dilewati dan dilaporkan.
      </p>

      {state.message && (
        <div className={`alert ${state.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '16px' }}>
          <span>{state.ok ? '📥' : '⚠️'}</span>
          <span>{state.message}</span>
        </div>
      )}

      <form action={action}>
        <RouterSelect
          routers={routers}
          defaultValue={selectedId}
          allowNone={false}
          label="Router sumber"
          help="Secret PPPoE dibaca dari router ini."
        />
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="due_day">Jatuh tempo default (tanggal 1–31)</label>
            <input id="due_day" name="due_day" type="number" min="1" max="31" required defaultValue="10" className="form-input font-mono" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="isolir_day">Tanggal isolir default (1–31)</label>
            <input id="isolir_day" name="isolir_day" type="number" min="1" max="31" required defaultValue="15" className="form-input font-mono" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SubmitButton loadingText="Mengimpor secret...">📥 Tarik PPPoE dari Router</SubmitButton>
        </div>
      </form>
    </>
  );
}
