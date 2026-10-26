import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { getCustomer } from '@/lib/billing';
import { query } from '@/lib/db';
import { CustomerEditForm } from './CustomerEditForm';

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
  }>('SELECT id, name, price, speed, mikrotik_profile FROM packages ORDER BY price ASC');

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <Link href={`/customers/${customer.id}`} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            ← Kembali ke Detail Pelanggan
          </Link>
          <h1 className="page-title" style={{ marginTop: '8px' }}>Edit Pelanggan: {customer.name}</h1>
          <p className="page-desc">
            Ubah konfigurasi akun, tanggal jatuh tempo, atau tanggal isolir pelanggan.
          </p>
        </div>
      </div>

      <CustomerEditForm customer={customer} packages={packages} />
    </div>
  );
}
