'use server';

import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { logActivity } from '@/lib/logs';
import { int } from '@/lib/action-state';

export async function clearAllLogs(): Promise<void> {
  await verifySession();
  await query('TRUNCATE TABLE activity_logs RESTART IDENTITY');
  await logActivity('info', 'logs.clear', 'Seluruh riwayat log aktivitas telah dibersihkan oleh admin');
  revalidatePath('/logs');
}

export async function deleteSingleLog(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  if (id) {
    await query('DELETE FROM activity_logs WHERE id = $1', [id]);
    revalidatePath('/logs');
  }
}
