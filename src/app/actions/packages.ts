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

  if (id) {
    await query(
      `UPDATE packages SET name=$1, price=$2, mikrotik_profile=$3, speed=$4, description=$5 WHERE id=$6`,
      [data.name, data.price, data.mikrotik_profile, data.speed || null, data.description || null, id],
    );
    await logActivity('info', 'package.update', `Paket ${data.name} diperbarui`);
  } else {
    await query(
      `INSERT INTO packages (name, price, mikrotik_profile, speed, description) VALUES ($1,$2,$3,$4,$5)`,
      [data.name, data.price, data.mikrotik_profile, data.speed || null, data.description || null],
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
