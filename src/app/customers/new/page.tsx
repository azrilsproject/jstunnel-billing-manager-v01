import { PageHeader } from '@/components/ui';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { todayStr } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { CustomerForm } from './CustomerForm';
import type { RouterOption } from '@/components/RouterSelect';

export default async function NewCustomerPage() {
  await verifySession();
  const packages = await query<{
    id: number;
    name: string;
    price: number;
    speed: string | null;
    mikrotik_profile: string;
  }>('SELECT id, name, price, speed, mikrotik_profile FROM packages ORDER BY price ASC');

  const routers = await query<RouterOption>(
    'SELECT id, name, host, enabled, is_default FROM routers ORDER BY is_default DESC, name ASC',
  );

  const today = todayStr();
  const currentDay = parseInt(today.slice(8, 10), 10);
  // Default jatuh tempo: tanggal hari ini atau tgl 10, isolir: 5 hari kemudian
  const defaultDue = currentDay;
  const defaultIsolir = defaultDue + 5 > 30 ? 5 : defaultDue + 5;

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <PageHeader
        back={{ href: '/customers', label: 'Daftar pelanggan' }}
        title="Tambah pelanggan"
        desc="Daftarkan pelanggan baru dan tentukan jadwal tagihan serta isolir."
      />

      <CustomerForm
        packages={packages}
        routers={routers}
        defaultActiveDate={today}
        defaultDueDay={defaultDue}
        defaultIsolirDay={defaultIsolir}
      />
    </div>
  );
}
