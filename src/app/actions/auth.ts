'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { queryOne, query } from '@/lib/db';
import { createSession, deleteSession } from '@/lib/session';
import { verifySession } from '@/lib/dal';
import { ActionState, fail, ok, str } from '@/lib/action-state';
import { logActivity } from '@/lib/logs';

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const username = str(fd, 'username');
  const password = str(fd, 'password');
  if (!username || !password) return fail('Username dan password wajib diisi');

  const admin = await queryOne<{ id: number; username: string; name: string; password_hash: string }>(
    'SELECT id, username, name, password_hash FROM admins WHERE username = $1',
    [username],
  );
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return fail('Username atau password salah');
  }
  await createSession({ adminId: admin.id, username: admin.username, name: admin.name });
  await logActivity('info', 'auth.login', `Admin ${admin.username} login`);
  redirect('/dashboard');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await verifySession();
  const current = str(fd, 'current_password');
  const next = str(fd, 'new_password');
  const confirm = str(fd, 'confirm_password');
  if (next.length < 6) return fail('Password baru minimal 6 karakter');
  if (next !== confirm) return fail('Konfirmasi password tidak sama');

  const admin = await queryOne<{ password_hash: string }>('SELECT password_hash FROM admins WHERE id = $1', [
    session.adminId,
  ]);
  if (!admin || !(await bcrypt.compare(current, admin.password_hash))) {
    return fail('Password lama salah');
  }
  await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(next, 10), session.adminId]);
  await logActivity('info', 'auth.password', `Admin ${session.username} mengganti password`);
  return ok('Password berhasil diganti');
}
