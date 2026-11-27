'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { query, queryOne, transaction } from '@/lib/db';
import { verifySession } from '@/lib/dal';
import { ActionState, fail, int, ok, str } from '@/lib/action-state';
import { logActivity } from '@/lib/logs';
import { getRouter } from '@/lib/routers';
import { testConnection } from '@/lib/mikrotik';

function revalidateRouters() {
  revalidatePath('/routers');
  revalidatePath('/dashboard');
  revalidatePath('/customers');
}

function parseRouter(fd: FormData) {
  const data = {
    name: str(fd, 'name'),
    host: str(fd, 'host'),
    port: int(fd, 'port') || (fd.get('tls') === 'on' ? 8729 : 8728),
    tls: fd.get('tls') === 'on',
    username: str(fd, 'username'),
    password: String(fd.get('password') ?? ''),
    isolir_profile: str(fd, 'isolir_profile') || 'ISOLIR',
    enabled: fd.get('enabled') === 'on',
    is_default: fd.get('is_default') === 'on',
    notes: str(fd, 'notes'),
  };
  const e: Record<string, string> = {};
  if (!data.name) e.name = 'Nama router wajib diisi';
  if (!data.host) e.host = 'Host / IP wajib diisi';
  if (!data.username) e.username = 'User API wajib diisi';
  if (!(data.port >= 1 && data.port <= 65535)) e.port = 'Port 1–65535';
  return { data, errors: e };
}

/** Simpan router baru (id kosong) atau perbarui router yang ada */
export async function saveRouter(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const id = int(fd, 'id') || 0;
  const { data, errors } = parseRouter(fd);
  if (Object.keys(errors).length) return fail('Periksa kembali isian router', errors);

  const dup = await queryOne('SELECT 1 FROM routers WHERE lower(name) = lower($1) AND id <> $2', [data.name, id]);
  if (dup) return fail('Nama router sudah dipakai', { name: 'Sudah dipakai router lain' });

  const savedId = await transaction(async (db) => {
    const { rows: countRows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM routers');
    // router pertama otomatis jadi default
    const makeDefault = data.is_default || countRows[0].n === 0;
    if (makeDefault) await db.query('UPDATE routers SET is_default = false WHERE is_default AND id <> $1', [id]);

    if (id) {
      // password kosong = tidak diubah
      const { rows } = await db.query<{ id: number }>(
        `UPDATE routers SET name=$1, host=$2, port=$3, tls=$4, username=$5,
           password = CASE WHEN $6 = '' THEN password ELSE $6 END,
           isolir_profile=$7, enabled=$8, is_default = (is_default OR $9), notes=$10
         WHERE id=$11 RETURNING id`,
        [data.name, data.host, data.port, data.tls, data.username, data.password,
          data.isolir_profile, data.enabled, makeDefault, data.notes || null, id],
      );
      return rows[0]?.id ?? null;
    }
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO routers (name, host, port, tls, username, password, isolir_profile, enabled, is_default, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [data.name, data.host, data.port, data.tls, data.username, data.password,
        data.isolir_profile, data.enabled, makeDefault, data.notes || null],
    );
    return rows[0].id;
  });
  if (!savedId) return fail('Router tidak ditemukan');

  await logActivity('info', id ? 'router.update' : 'router.create',
    `Router ${data.name} (${data.host}:${data.port}) ${id ? 'diperbarui' : 'ditambahkan'}`);
  revalidateRouters();
  if (!id) redirect(`/routers?router=${savedId}`);
  return ok(`Router ${data.name} berhasil disimpan`);
}

export async function setDefaultRouter(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const r = await getRouter(id);
  if (!r) return;
  await transaction(async (db) => {
    await db.query('UPDATE routers SET is_default = false WHERE is_default');
    await db.query('UPDATE routers SET is_default = true WHERE id = $1', [id]);
  });
  await logActivity('info', 'router.default', `Router ${r.name} dijadikan default untuk pelanggan baru`);
  revalidateRouters();
}

export async function toggleRouterEnabled(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const r = await queryOne<{ name: string; enabled: boolean }>(
    'UPDATE routers SET enabled = NOT enabled WHERE id = $1 RETURNING name, enabled', [id],
  );
  if (!r) return;
  await logActivity('warning', 'router.toggle', `Router ${r.name} ${r.enabled ? 'diaktifkan' : 'dinonaktifkan'}`);
  revalidateRouters();
}

export async function deleteRouter(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const moveTo = int(fd, 'move_to') || null;
  const r = await getRouter(id);
  if (!r) return;
  if (moveTo === id) return;

  const moved = await transaction(async (db) => {
    const { rowCount } = await db.query('UPDATE customers SET router_id = $1 WHERE router_id = $2', [moveTo, id]);
    // paket khusus router ini ikut pindah bersama pelanggannya (atau jadi paket semua router)
    await db.query('UPDATE packages SET router_id = $1 WHERE router_id = $2', [moveTo, id]);
    await db.query('DELETE FROM routers WHERE id = $1', [id]);
    if (r.is_default) {
      // pilih router lain sebagai default
      await db.query(
        `UPDATE routers SET is_default = true WHERE id = (
           SELECT id FROM routers ORDER BY enabled DESC, id ASC LIMIT 1)`,
      );
    }
    return rowCount ?? 0;
  });
  const target = moveTo ? (await getRouter(moveTo))?.name : null;
  await logActivity('warning', 'router.delete',
    `Router ${r.name} dihapus. ${moved} pelanggan ${target ? `dipindah ke ${target}` : 'dilepas dari router'} (secret di router tidak diubah)`);
  revalidateRouters();
  redirect('/routers');
}

/** Uji koneksi router tersimpan, atau isian form yang belum disimpan */
export async function testRouterAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const id = int(fd, 'id') || 0;
  const saved = id ? await getRouter(id) : null;
  const host = str(fd, 'host') || saved?.host || '';
  const username = str(fd, 'username') || saved?.username || '';
  const password = String(fd.get('password') ?? '') || saved?.password || '';
  const tls = fd.has('host') ? fd.get('tls') === 'on' : !!saved?.tls;
  const port = int(fd, 'port') || saved?.port || (tls ? 8729 : 8728);
  const name = str(fd, 'name') || saved?.name || host;

  if (!host || !username) return fail('Host dan User API wajib diisi untuk tes koneksi');
  try {
    const res = await testConnection({ name, host, port, tls, username, password, enabled: true });
    return ok(
      `Terkoneksi ke "${res.identity}" • ${res.board} • RouterOS ${res.version} • Uptime ${res.uptime} • ` +
        `${res.secretCount} secret, ${res.activeCount} online • Profil PPP: ${res.profiles.join(', ')}`,
    );
  } catch (err) {
    return fail(`Koneksi ke ${name} gagal: ${(err as Error).message}`);
  }
}

/** Pindahkan banyak pelanggan dari satu router ke router lain (hanya di database) */
export async function moveCustomersBetweenRouters(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const from = str(fd, 'from');
  const to = int(fd, 'to') || null;
  const fromId = from === 'none' ? null : parseInt(from, 10) || null;
  if (from !== 'none' && !fromId) return fail('Pilih router asal');
  if (fromId === to) return fail('Router asal dan tujuan sama');

  // hanya pelanggan yang paketnya juga berlaku di router tujuan yang dipindah (agar tarif tidak berubah diam-diam)
  const source = fromId ? 'c.router_id = $2' : 'c.router_id IS NULL';
  const rows = await query<{ id: number }>(
    `UPDATE customers c SET router_id = $1, updated_at = now()
     FROM packages p
     WHERE p.id = c.package_id AND ${source} AND (p.router_id IS NULL OR p.router_id = $1)
     RETURNING c.id`,
    fromId ? [to, fromId] : [to],
  );
  const left = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM customers c WHERE ${fromId ? 'c.router_id = $1' : 'c.router_id IS NULL'}`,
    fromId ? [fromId] : [],
  );
  const skipped = left?.n
    ? ` ${left.n} pelanggan tidak dipindah karena paketnya khusus router asal — ganti paketnya dulu (atau jadikan paket "Semua router").`
    : '';
  const toName = to ? (await getRouter(to))?.name : '(tanpa router)';
  await logActivity('info', 'router.move', `${rows.length} pelanggan dipindah ke ${toName}`);
  revalidateRouters();
  return ok(`${rows.length} pelanggan dipindahkan ke ${toName}. Jalankan "Sync" per pelanggan bila secret perlu dibuat di router baru.${skipped}`);
}
