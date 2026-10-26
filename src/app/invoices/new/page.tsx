import Link from 'next/link';
import { query } from '@/lib/db';
import { verifySession } from '@/lib/dal';
import { ManualInvoiceForm, CustomerOption, PackageOption } from './ManualInvoiceForm';

export const metadata = {
  title: 'Buat Invoice Manual - JAMES BILLING',
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
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Link href="/invoices" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              ← Kembali ke Daftar Invoice
            </Link>
          </div>
          <h1 className="page-title">Buat Invoice Manual</h1>
          <p className="page-desc">
            Terbitkan tagihan baru untuk pelanggan tertentu, sesuaikan nominal, periode, dan tanggal jatuh tempo.
          </p>
        </div>
      </div>

      <ManualInvoiceForm
        customers={customers}
        packages={packages}
        defaultCustomerId={defaultCustomerId}
      />
    </div>
  );
}
