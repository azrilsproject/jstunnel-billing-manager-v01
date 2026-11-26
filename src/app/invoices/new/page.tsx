import { PageHeader } from '@/components/ui';
import { query } from '@/lib/db';
import { verifySession } from '@/lib/dal';
import { ManualInvoiceForm, CustomerOption, PackageOption } from './ManualInvoiceForm';

export const metadata = {
  title: 'Buat Invoice Manual - Billing Manager',
};

type Props = {
  searchParams: Promise<{ customerId?: string }>;
};

export default async function NewInvoicePage({ searchParams }: Props) {
  await verifySession();
  const params = await searchParams;
  const defaultCustomerId = params.customerId ? Number(params.customerId) : undefined;

  const customers = await query<CustomerOption>(`
    SELECT c.id, c.code, c.name, c.phone, c.pppoe_username, c.due_day, c.isolir_day,
           p.id AS package_id, p.name AS package_name, p.price
    FROM customers c
    JOIN packages p ON p.id = c.package_id
    WHERE c.status != 'inactive'
    ORDER BY c.name ASC
  `);

  const packages = await query<PackageOption>(`
    SELECT id, name, price
    FROM packages
    ORDER BY price ASC
  `);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader
        back={{ href: '/invoices', label: 'Daftar tagihan' }}
        title="Buat invoice manual"
        desc="Terbitkan tagihan untuk pelanggan tertentu dengan nominal dan tanggal sendiri."
      />

      <ManualInvoiceForm
        customers={customers}
        packages={packages}
        defaultCustomerId={defaultCustomerId}
      />
    </div>
  );
}
