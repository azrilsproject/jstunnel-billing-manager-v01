import { verifySession } from '@/lib/dal';
import { getSettings } from '@/lib/settings';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  await verifySession();
  const settings = await getSettings();

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pengaturan Sistem & MikroTik</h1>
          <p className="page-desc">
            Konfigurasi koneksi RouterOS, aturan tanggal isolir otomatis, dan identitas invoice.
          </p>
        </div>
        <div className="header-actions">
          <a
            href="#script-isolir"
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            🛡️ Script Isolir (ROS 6 & 7)
          </a>
        </div>
      </div>

      <SettingsClient initialSettings={settings} />
    </div>
  );
}
