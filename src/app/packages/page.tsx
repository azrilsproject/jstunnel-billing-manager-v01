import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { PackageList } from './PackageList';

export default async function PackagesPage() {
  await verifySession();

  const packages = await query<{
    id: number;
    name: string;
    price: number;
    mikrotik_profile: string;
    speed: string | null;
    description: string | null;
    customer_count: number;
  }>(`
    SELECT 
      p.id, p.name, p.price, p.mikrotik_profile, p.speed, p.description,
      count(c.id)::int AS customer_count
    FROM packages p
    LEFT JOIN customers c ON c.package_id = p.id
    GROUP BY p.id, p.name, p.price, p.mikrotik_profile, p.speed, p.description
    ORDER BY p.price ASC
  `);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paket Layanan Internet</h1>
          <p className="page-desc">
            Atur tarif bulanan, profil PPP MikroTik, dan kecepatan bandwidth per paket.
          </p>
        </div>
      </div>

      <PackageList initialPackages={packages} />
    </div>
  );
}
