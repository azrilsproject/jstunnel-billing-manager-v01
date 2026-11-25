import { PageHeader } from '@/components/ui';
import { verifySession } from '@/lib/dal';
import { CustomerImportForm } from './CustomerImportForm';
import { query } from '@/lib/db';
import type { RouterOption } from '@/components/RouterSelect';

export default async function ImportCustomerPage() {
  await verifySession();
  const routers = await query<RouterOption>(
    'SELECT id, name, host, enabled, is_default FROM routers ORDER BY is_default DESC, name ASC',
  );

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
      <PageHeader
        back={{ href: '/customers', label: 'Daftar pelanggan' }}
        title="Import pelanggan"
        desc="Unggah CSV atau tempel data untuk mendaftarkan banyak pelanggan sekaligus."
      />

      <CustomerImportForm routers={routers} />
    </div>
  );
}
