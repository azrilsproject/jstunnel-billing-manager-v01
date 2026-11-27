import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { listRouters } from '@/lib/routers';
import { PageHeader } from '@/components/ui';
import { PackageList, PackageRow } from './PackageList';

type Props = {
  searchParams: Promise<{ router?: string }>;
};

export default async function PackagesPage({ searchParams }: Props) {
  await verifySession();
  const { router = '' } = await searchParams;

  const routers = (await listRouters()).map((r) => ({
    id: r.id,
    name: r.name,
    host: r.host,
    enabled: r.enabled,
    is_default: r.is_default,
  }));
  const selected = routers.find((r) => String(r.id) === router) ?? null;

  const all = await query<PackageRow>(`
    SELECT p.id, p.name, p.price, p.mikrotik_profile, p.speed, p.description,
           p.router_id, r.name AS router_name, count(c.id)::int AS customer_count
    FROM packages p
    LEFT JOIN routers r ON r.id = p.router_id
    LEFT JOIN customers c ON c.package_id = p.id
    GROUP BY p.id, r.name
    ORDER BY p.price ASC, p.name ASC
  `);

  // tab router: paket khusus router itu + paket yang berlaku di semua router
  const visible = selected ? all.filter((p) => p.router_id === null || p.router_id === selected.id) : all;

  return (
    <div>
      <PageHeader title="Paket" desc="Tiap router bisa punya paket, tarif, dan profile PPP sendiri." />

      {routers.length > 0 && (
        <div className="router-switcher" aria-label="Filter router">
          <Link href="/packages" className={`router-tab ${!selected ? 'is-active' : ''}`}>
            Semua paket <span className="router-tab-count">{all.length}</span>
          </Link>
          {routers.map((r) => (
            <Link key={r.id} href={`/packages?router=${r.id}`} className={`router-tab ${selected?.id === r.id ? 'is-active' : ''}`}>
              <span className="badge-dot" style={{ background: r.enabled ? '#22c55e' : '#94a3b8' }} />
              {r.name}
              <span className="router-tab-count">
                {all.filter((p) => p.router_id === null || p.router_id === r.id).length}
              </span>
            </Link>
          ))}
        </div>
      )}

      <PackageList key={selected?.id ?? 'all'} initialPackages={visible} routers={routers} selectedRouterId={selected?.id ?? null} />
    </div>
  );
}
