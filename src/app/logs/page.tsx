import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { formatDateTime } from '@/lib/dates';
import { clearAllLogs, deleteSingleLog } from '@/app/actions/logs';
import { DeleteConfirmForm } from '@/components/DeleteConfirmForm';
import { EmptyState, Icon, PageHeader } from '@/components/ui';

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

  const tone: Record<string, string> = { error: 'tone-red', warning: 'tone-amber', success: 'tone-green', info: 'tone-blue' };
  const icon = { error: 'x', warning: 'alert', success: 'check', info: 'info' } as const;
  const tabs = [
    { v: '', label: 'Semua' },
    { v: 'success', label: 'Sukses' },
    { v: 'warning', label: 'Peringatan' },
    { v: 'error', label: 'Error' },
    { v: 'info', label: 'Info' },
  ];

  return (
    <div>
      <PageHeader
        title="Log Aktivitas"
        desc="Jejak otomatis invoice, pembayaran, isolir, dan perubahan akun (100 terbaru)."
        actions={
          <DeleteConfirmForm
            action={clearAllLogs}
            confirmMessage="Hapus seluruh catatan riwayat log aktivitas? Tindakan ini tidak dapat dibatalkan."
          >
            <button type="submit" className="btn btn-secondary text-danger">
              <Icon name="x" size={15} /> Bersihkan Log
            </button>
          </DeleteConfirmForm>
        }
      />

      <div className="router-switcher">
        {tabs.map((t) => (
          <Link key={t.v} href={t.v ? `/logs?level=${t.v}` : '/logs'} className={`router-tab ${level === t.v ? 'is-active' : ''}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <section className="panel">
        {logs.length === 0 ? (
          <EmptyState icon="list" title="Tidak ada log">Belum ada catatan pada filter ini.</EmptyState>
        ) : (
          <div className="feed">
            {logs.map((log) => (
              <div key={log.id} className="feed-item">
                <span className={`feed-dot ${tone[log.level] ?? 'tone-slate'}`}>
                  <Icon name={icon[log.level as keyof typeof icon] ?? 'info'} size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="feed-msg">{log.message}</div>
                  <div className="feed-meta">
                    {formatDateTime(log.created_at)} · <span className="mono">{log.action}</span>
                    {log.customer_id && (
                      <>
                        {' · '}
                        <Link href={`/customers/${log.customer_id}`}>{log.customer_name} ({log.customer_code})</Link>
                      </>
                    )}
                  </div>
                </div>
                <form action={deleteSingleLog}>
                  <input type="hidden" name="id" value={log.id} />
                  <button type="submit" className="icon-btn" title="Hapus baris log ini" aria-label="Hapus log">
                    <Icon name="x" size={14} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
