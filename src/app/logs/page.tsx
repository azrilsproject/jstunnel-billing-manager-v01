import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { formatDateTime } from '@/lib/dates';
import { clearAllLogs, deleteSingleLog } from '@/app/actions/logs';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';

type Props = {
  searchParams: Promise<{ level?: string }>;
};

export default async function LogsPage({ searchParams }: Props) {
  await verifySession();
  const { level = '' } = await searchParams;

  let where = '1=1';
  const params: unknown[] = [];
  if (level && ['info', 'success', 'warning', 'error'].includes(level)) {
    params.push(level);
    where += ` AND l.level = $${params.length}`;
  }

  const logs = await query<{
    id: number;
    level: string;
    action: string;
    message: string;
    created_at: string;
    customer_id: number | null;
    customer_name: string | null;
    customer_code: string | null;
  }>(`
    SELECT 
      l.id, l.level, l.action, l.message, l.created_at, l.customer_id,
      c.name AS customer_name, c.code AS customer_code
    FROM activity_logs l
    LEFT JOIN customers c ON c.id = l.customer_id
    WHERE ${where}
    ORDER BY l.created_at DESC
    LIMIT 100
  `, params);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Log Aktivitas Sistem</h1>
          <p className="page-desc">
            Audit trail otomatis setiap kali terjadi transaksi invoice, isolir router, atau perubahan akun.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/logs" className={`btn btn-sm ${!level ? 'btn-primary' : 'btn-secondary'}`}>
            Semua
          </Link>
          <Link href="/logs?level=success" className={`btn btn-sm ${level === 'success' ? 'btn-primary' : 'btn-secondary'}`}>
            Sukses
          </Link>
          <Link href="/logs?level=warning" className={`btn btn-sm ${level === 'warning' ? 'btn-primary' : 'btn-secondary'}`}>
            Isolir / Peringatan
          </Link>
          <Link href="/logs?level=error" className={`btn btn-sm ${level === 'error' ? 'btn-primary' : 'btn-secondary'}`}>
            Error
          </Link>
          <DeleteConfirmForm
            action={clearAllLogs}
            confirmMessage="Hapus seluruh catatan riwayat log aktivitas? Tindakan ini tidak dapat dibatalkan."
          >
            <button type="submit" className="btn btn-danger btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              🗑️ Bersihkan Log
            </button>
          </DeleteConfirmForm>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Tingkat</th>
              <th style={{ width: '160px' }}>Waktu Kejadian</th>
              <th style={{ width: '150px' }}>Kategori Aksi</th>
              <th>Pesan Log</th>
              <th>Terkait Pelanggan</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                  Tidak ada catatan log pada filter ini.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color:
                          log.level === 'error'
                            ? '#f87171'
                            : log.level === 'warning'
                            ? '#fbbf24'
                            : log.level === 'success'
                            ? '#34d399'
                            : '#93c5fd',
                      }}
                    >
                      <span>
                        {log.level === 'error' ? '❌' : log.level === 'warning' ? '⚠️' : log.level === 'success' ? '✅' : 'ℹ️'}
                      </span>
                      <span style={{ textTransform: 'uppercase' }}>{log.level}</span>
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDateTime(log.created_at)}
                    </span>
                  </td>
                  <td>
                    <code className="font-mono" style={{ fontSize: '12px', color: '#a78bfa' }}>
                      {log.action}
                    </code>
                  </td>
                  <td>
                    <div style={{ color: '#fff', fontSize: '13px', wordBreak: 'break-word' }}>
                      {log.message}
                    </div>
                  </td>
                  <td>
                    {log.customer_id ? (
                      <Link href={`/customers/${log.customer_id}`} style={{ fontSize: '12.5px' }}>
                        {log.customer_name} ({log.customer_code})
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>-</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <form action={deleteSingleLog}>
                      <input type="hidden" name="id" value={log.id} />
                      <button
                        type="submit"
                        className="btn btn-danger"
                        style={{ padding: '2px 8px', height: '24px', fontSize: '11px', borderRadius: '4px' }}
                        title="Hapus baris log ini"
                      >
                        ✕
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
