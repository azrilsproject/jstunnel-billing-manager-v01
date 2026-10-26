import 'server-only';
import { query } from './db';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export async function logActivity(
  level: LogLevel,
  action: string,
  message: string,
  customerId: number | null = null,
) {
  try {
    await query(
      'INSERT INTO activity_logs (level, action, message, customer_id) VALUES ($1, $2, $3, $4)',
      [level, action, message, customerId],
    );
  } catch (err) {
    console.error('[log] gagal menulis log:', err);
  }
}
