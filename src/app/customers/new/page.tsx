import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { todayStr } from '@/lib/dates';
import { rupiah } from '@/lib/format';
import { CustomerForm } from './CustomerForm';

export default async function NewCustomerPage() {
  await verifySession();
  const packages = await query<{
    id: number;
    name: string;
    price: number;
    speed: string | null;
    mikrotik_profile: string;
  }>('SELECT id, name, price, speed, mikrotik_profile FROM packages ORDER BY price ASC');

  const today = todayStr();
  const currentDay = parseInt(today.slice(8, 10), 10);
  // Default jatuh tempo: tanggal hari ini atau tgl 10, isolir: 5 hari kemudian
  const defaultDue = currentDay;
  const defaultIsolir = defaultDue + 5 > 30 ? 5 : defaultDue + 5;

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <Link href="/customers" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            ← Kembali ke Daftar Pelanggan
          </Link>
          <h1 className="page-title" style={{ marginTop: '8px' }}>Tambah Pelanggan Baru</h1>
          <p className="page-desc">
            Daftarkan pelanggan baru, tentukan tanggal aktif dan tanggal isolir bulanan.
          </p>
        </div>
      </div>

      <CustomerForm
        packages={packages}
        defaultActiveDate={today}
        defaultDueDay={defaultDue}
        defaultIsolirDay={defaultIsolir}
      />
    </div>
  );
}
