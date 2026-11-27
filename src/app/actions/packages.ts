'use server';

import { revalidatePath } from 'next/cache';
import { query, queryOne } from '@/lib/db';
import { verifySession } from '@/lib/dal';
import { ActionState, fail, int, ok, str } from '@/lib/action-state';
import { logActivity } from '@/lib/logs';

function parse(fd: FormData) {
  const data = {
    name: str(fd, 'name'),
    price: int(fd, 'price'),
    mikrotik_profile: str(fd, 'mikrotik_profile'),
    speed: str(fd, 'speed'),
    description: str(fd, 'description'),
    router_id: int(fd, 'router_id') || null,
  };
  const errors: Record<string, string> = {};
  if (!data.name) errors.name = 'Nama paket wajib diisi';
  if (!Number.isFinite(data.price) || data.price < 0) errors.price = 'Harga tidak valid';
  if (!data.mikrotik_profile) errors.mikrotik_profile = 'Profile MikroTik wajib diisi';
  return { data, errors };
}

export async function savePackage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const id = int(fd, 'id');
  const { data, errors } = parse(fd);
  if (Object.keys(errors).length) return fail('Periksa kembali isian', errors);

  if (data.router_id) {
    const router = await queryOne('SELECT 1 FROM routers WHERE id = $1', [data.router_id]);
    if (!router) return fail('Router tidak ditemukan', { router_id: 'Pilih router yang ada' });
    // paket yang dipakai pelanggan router lain tidak boleh dikhususkan ke router ini
    if (id) {
      const other = await queryOne<{ n: number }>(
        'SELECT count(*)::int AS n FROM customers WHERE package_id = $1 AND router_id IS DISTINCT FROM $2',
        [id, data.router_id],
      );
      if (other && other.n > 0) {
        return fail(`Tidak bisa dikhususkan ke router ini: ${other.n} pelanggan di router lain / tanpa router masih memakai paket ini. Pindahkan paket mereka dulu.`);
      }
    }
  }

  if (id) {
    await query(
      `UPDATE packages SET name=$1, price=$2, mikrotik_profile=$3, speed=$4, description=$5, router_id=$6 WHERE id=$7`,
      [data.name, data.price, data.mikrotik_profile, data.speed || null, data.description || null, data.router_id, id],
    );
    await logActivity('info', 'package.update', `Paket ${data.name} diperbarui`);
  } else {
    await query(
      `INSERT INTO packages (name, price, mikrotik_profile, speed, description, router_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [data.name, data.price, data.mikrotik_profile, data.speed || null, data.description || null, data.router_id],
    );
    await logActivity('info', 'package.create', `Paket ${data.name} dibuat`);
  }
  revalidatePath('/packages');
  return ok(id ? 'Paket diperbarui' : 'Paket ditambahkan');
}

export async function deletePackage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const id = int(fd, 'id');
  const used = await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM customers WHERE package_id = $1', [id]);
  if (used && used.n > 0) return fail(`Paket masih dipakai ${used.n} pelanggan`);
  await query('DELETE FROM packages WHERE id = $1', [id]);
  revalidatePath('/packages');
  return ok('Paket dihapus');
}
