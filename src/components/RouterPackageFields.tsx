'use client';

import { useEffect, useRef, useState } from 'react';
import { RouterOption, RouterSelect } from '@/components/RouterSelect';
import { packageFitsRouter } from '@/lib/package-scope';
import { rupiah } from '@/lib/format';

export type PackageChoice = {
  id: number;
  name: string;
  price: number;
  speed: string | null;
  mikrotik_profile: string;
  router_id: number | null;
};

type Props = {
  routers: RouterOption[];
  packages: PackageChoice[];
  /** undefined = pakai router default; null = tanpa router */
  defaultRouterId?: number | null;
  defaultPackageId?: number;
  error?: string;
  routerHelp?: React.ReactNode;
};

/** Pilih router dulu, lalu daftar paket menyesuaikan router tersebut */
export function RouterPackageFields({ routers, packages, defaultRouterId, defaultPackageId, error, routerHelp }: Props) {
  const initial =
    defaultRouterId === undefined
      ? routers.find((r) => r.is_default)?.id ?? routers[0]?.id ?? null
      : defaultRouterId;
  const [routerId, setRouterId] = useState<number | null>(initial);
  const ref = useRef<HTMLDivElement>(null);

  // React mereset form setelah action; samakan lagi daftar paket dengan pilihan router awal
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const onReset = () => setRouterId(initial);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [initial]);

  const available = packages.filter((p) => packageFitsRouter(p.router_id, routerId));

  return (
    <div className="form-row" ref={ref}>
      <RouterSelect
        routers={routers}
        defaultValue={initial}
        help={routerHelp}
        onChange={(v) => setRouterId(v ? Number(v) : null)}
      />
      <div className="form-group">
        <label className="form-label" htmlFor="package_id">
          Pilihan Paket Layanan *
        </label>
        <select
          key={routerId ?? 'none'}
          id="package_id"
          name="package_id"
          required
          defaultValue={available.some((p) => p.id === defaultPackageId) ? defaultPackageId : ''}
          className="form-select"
        >
          <option value="">-- Pilih Paket Internet --</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {rupiah(p.price)}/bln ({p.speed || 'Profil: ' + p.mikrotik_profile})
            </option>
          ))}
        </select>
        <div className="form-help">
          {available.length
            ? 'Hanya paket yang berlaku di router terpilih yang ditampilkan.'
            : 'Belum ada paket untuk router ini. Tambahkan di menu Paket.'}
        </div>
        {error && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
      </div>
    </div>
  );
}
