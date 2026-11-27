import { PageHeader } from '@/components/ui';
import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { getCustomer } from '@/lib/billing';
import { query } from '@/lib/db';
import { CustomerEditForm } from './CustomerEditForm';
import type { RouterOption } from '@/components/RouterSelect';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: Props) {
  await verifySession();
  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (!customerId) notFound();

  const customer = await getCustomer(customerId);
  if (!customer) notFound();

  const packages = await query<{
    id: number;
    name: string;
    price: number;
    speed: string | null;
    mikrotik_profile: string;
    router_id: number | null;
  }>('SELECT id, name, price, speed, mikrotik_profile, router_id FROM packages ORDER BY price ASC');

  const routers = await query<RouterOption>(
    'SELECT id, name, host, enabled, is_default FROM routers ORDER BY is_default DESC, name ASC',
  );

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <PageHeader
        back={{ href: `/customers/${customer.id}`, label: 'Detail pelanggan' }}
        title={`Edit ${customer.name}`}
        desc="Ubah akun, paket, router, dan jadwal tagihan pelanggan."
      />

      <CustomerEditForm customer={customer} packages={packages} routers={routers} />
    </div>
  );
}
