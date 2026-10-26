import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { CustomerImportForm } from './CustomerImportForm';

export default async function ImportCustomerPage() {
  await verifySession();

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <Link href="/customers" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            ← Kembali ke Pelanggan PPPoE
          </Link>
          <h1 className="page-title" style={{ marginTop: '8px' }}>Import Pelanggan PPPoE</h1>
          <p className="page-desc">
            Unggah file CSV atau salin data pelanggan secara massal untuk pendaftaran otomatis ke sistem billing dan MikroTik.
          </p>
        </div>
      </div>

      <CustomerImportForm />
    </div>
  );
}
