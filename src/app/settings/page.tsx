import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { getSettings } from '@/lib/settings';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  await verifySession();
  const settings = await getSettings();

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pengaturan</h1>
          <p className="page-desc">Identitas usaha di invoice, aturan penagihan & isolir otomatis, dan keamanan akun.</p>
        </div>
      </div>

      <Link href="/routers" className="callout-link">
        <span style={{ fontSize: '22px' }}>📡</span>
        <span>
          <strong>Mengatur router MikroTik?</strong>
          <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Tambah, ganti, dan uji koneksi banyak router sekarang ada di menu Router MikroTik.
          </span>
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontWeight: 600 }}>Buka →</span>
      </Link>

      <SettingsClient initialSettings={settings} />
    </div>
  );
}
