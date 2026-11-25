import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/ui';
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
      <PageHeader title="Paket" desc="Tarif bulanan, profile PPP MikroTik, dan kecepatan tiap paket." />

      <PackageList initialPackages={packages} />
    </div>
  );
}
