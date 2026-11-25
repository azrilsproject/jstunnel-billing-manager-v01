'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { query, queryOne } from '@/lib/db';
import { verifySession } from '@/lib/dal';
import { ActionState, fail, int, ok, str } from '@/lib/action-state';
import { logActivity } from '@/lib/logs';
import { todayStr } from '@/lib/dates';
import {
  generateInvoices,
  getCustomer,
  isolateCustomer,
  restoreCustomer,
  setCustomerInactiveOnRouter,
  syncCustomerToMikrotik,
} from '@/lib/billing';
import { listSecrets, removeSecret, upsertSecret } from '@/lib/mikrotik';
import { getRouter, isRouterUsable } from '@/lib/routers';
import { parseCsv } from '@/lib/csv';

const USERNAME_RE = /^[A-Za-z0-9._@-]+$/;

function parseCustomer(fd: FormData) {
  const bType = str(fd, 'billing_type');
  const data = {
    name: str(fd, 'name'),
    phone: str(fd, 'phone'),
    address: str(fd, 'address'),
    pppoe_username: str(fd, 'pppoe_username'),
    pppoe_password: str(fd, 'pppoe_password'),
    package_id: int(fd, 'package_id'),
    billing_type: (bType === 'postpaid' ? 'postpaid' : 'prepaid') as 'prepaid' | 'postpaid',
    active_date: str(fd, 'active_date'),
    due_day: int(fd, 'due_day'),
    isolir_day: int(fd, 'isolir_day'),
    notes: str(fd, 'notes'),
    router_id: int(fd, 'router_id') || null,
  };
  const e: Record<string, string> = {};
  if (!data.name) e.name = 'Nama wajib diisi';
  if (!data.pppoe_username) e.pppoe_username = 'Username PPPoE wajib diisi';
  else if (!USERNAME_RE.test(data.pppoe_username)) e.pppoe_username = 'Hanya huruf, angka, . _ @ -';
  if (!data.pppoe_password) e.pppoe_password = 'Password PPPoE wajib diisi';
  if (!data.package_id) e.package_id = 'Pilih paket';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.active_date)) e.active_date = 'Tanggal aktif tidak valid';
  if (!(data.due_day >= 1 && data.due_day <= 31)) e.due_day = 'Tanggal 1–31';
  if (!(data.isolir_day >= 1 && data.isolir_day <= 31)) e.isolir_day = 'Tanggal 1–31';
  return { data, errors: e };
}

function revalidateCustomer(id?: number) {
  revalidatePath('/customers');
  revalidatePath('/dashboard');
  revalidatePath('/invoices');
  if (id) revalidatePath(`/customers/${id}`);
}

export async function createCustomer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const { data, errors } = parseCustomer(fd);
  if (Object.keys(errors).length) return fail('Periksa kembali isian', errors);

  const dup = await queryOne('SELECT 1 FROM customers WHERE pppoe_username = $1', [data.pppoe_username]);
  if (dup) return fail('Username PPPoE sudah dipakai', { pppoe_username: 'Sudah dipakai pelanggan lain' });

  const row = await queryOne<{ id: number; code: string }>(
    `INSERT INTO customers (name, phone, address, pppoe_username, pppoe_password, package_id,
                            billing_type, active_date, due_day, isolir_day, notes, router_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, code`,
    [
      data.name, data.phone || null, data.address || null, data.pppoe_username, data.pppoe_password,
      data.package_id, data.billing_type, data.active_date, data.due_day, data.isolir_day, data.notes || null,
      data.router_id,
    ],
  );
  const id = row!.id;
  const tipeStr = data.billing_type === 'postpaid' ? 'Pascabayar' : 'Prabayar';
  await logActivity('success', 'customer.create', `Pelanggan ${row!.code} - ${data.name} (${tipeStr}) ditambahkan`, id);

  const msgs: string[] = ['Pelanggan ditambahkan'];
  if (fd.get('sync_mikrotik') === 'on') {
    const r = await syncCustomerToMikrotik(id);
    msgs.push(r.message);
  }
  if (fd.get('create_invoice') === 'on') {
    if (data.billing_type === 'postpaid') {
      msgs.push('Pascabayar: Tagihan pertama akan terbit bulan depan');
    } else {
      const r = await generateInvoices({ customerId: id, force: true });
      if (r.created.length) msgs.push(`Invoice ${r.created.join(', ')} dibuat`);
    }
  }
  revalidateCustomer(id);
  redirect(`/customers/${id}?msg=${encodeURIComponent(msgs.join('. '))}`);
}

export async function updateCustomer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const id = int(fd, 'id');
  const before = await getCustomer(id);
  if (!before) return fail('Pelanggan tidak ditemukan');

  const { data, errors } = parseCustomer(fd);
  if (Object.keys(errors).length) return fail('Periksa kembali isian', errors);

  const dup = await queryOne('SELECT 1 FROM customers WHERE pppoe_username = $1 AND id <> $2', [
    data.pppoe_username, id,
  ]);
  if (dup) return fail('Username PPPoE sudah dipakai', { pppoe_username: 'Sudah dipakai pelanggan lain' });

  await query(
    `UPDATE customers SET name=$1, phone=$2, address=$3, pppoe_username=$4, pppoe_password=$5,
       package_id=$6, billing_type=$7, active_date=$8, due_day=$9, isolir_day=$10, notes=$11,
       router_id=$12, updated_at=now()
     WHERE id=$13`,
    [
      data.name, data.phone || null, data.address || null, data.pppoe_username, data.pppoe_password,
      data.package_id, data.billing_type, data.active_date, data.due_day, data.isolir_day, data.notes || null,
      data.router_id, id,
    ],
  );
  await logActivity('info', 'customer.update', `Data pelanggan ${before.code} - ${data.name} diperbarui`, id);

  const msgs = ['Data pelanggan disimpan'];
  if (fd.get('sync_mikrotik') === 'on') {
    const r = await syncCustomerToMikrotik(id, {
      previousUsername: before.pppoe_username,
      previousRouterId: before.router_id,
    });
    msgs.push(r.message);
  }
  revalidateCustomer(id);
  redirect(`/customers/${id}?msg=${encodeURIComponent(msgs.join('. '))}`);
}

export async function deleteCustomer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const id = int(fd, 'id');
  const c = await getCustomer(id);
  if (!c) return fail('Pelanggan tidak ditemukan');

  if (fd.get('remove_secret') === 'on') {
    const router = await getRouter(c.router_id);
    if (isRouterUsable(router)) {
      try {
        await removeSecret(router, c.pppoe_username);
      } catch (err) {
        return fail(`Gagal hapus secret di MikroTik: ${(err as Error).message}`);
      }
    }
  }
  await query('DELETE FROM customers WHERE id = $1', [id]);
  await logActivity('warning', 'customer.delete', `Pelanggan ${c.code} - ${c.name} dihapus`);
  revalidateCustomer();
  redirect('/customers');
}

export async function deleteCustomerDirect(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const c = await getCustomer(id);
  if (!c) return;

  const removeSecretFromRouter = fd.get('remove_secret') !== 'off';
  if (removeSecretFromRouter) {
    const router = await getRouter(c.router_id);
    if (isRouterUsable(router)) {
      try {
        await removeSecret(router, c.pppoe_username);
      } catch {
        // Router might be offline or secret already deleted
      }
    }
  }
  await query('DELETE FROM customers WHERE id = $1', [id]);
  await logActivity('warning', 'customer.delete', `Pelanggan ${c.code} - ${c.name} dihapus`);
  revalidateCustomer();
  redirect('/customers');
}

export async function isolateNow(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const r = await isolateCustomer(id, 'Isolir manual oleh admin');
  revalidateCustomer(id);
  redirect(`/customers/${id}?msg=${encodeURIComponent(r.message)}`);
}

export async function restoreNow(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const r = await restoreCustomer(id, 'Buka isolir manual oleh admin');
  revalidateCustomer(id);
  redirect(`/customers/${id}?msg=${encodeURIComponent(r.message)}`);
}

export async function syncNow(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const r = await syncCustomerToMikrotik(id);
  revalidateCustomer(id);
  redirect(`/customers/${id}?msg=${encodeURIComponent(r.message)}`);
}

export async function setInactive(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const inactive = str(fd, 'inactive') === 'true';
  const c = await getCustomer(id);
  if (!c) return;

  await query(`UPDATE customers SET status = $1, updated_at = now() WHERE id = $2`, [
    inactive ? 'inactive' : 'active', id,
  ]);
  await setCustomerInactiveOnRouter(id, inactive);
  if (!inactive) await syncCustomerToMikrotik(id);
  await logActivity(
    inactive ? 'warning' : 'success',
    inactive ? 'customer.inactive' : 'customer.reactivate',
    `${c.name} ${inactive ? 'berhenti berlangganan (secret di-disable)' : 'diaktifkan kembali'}`,
    id,
  );
  revalidateCustomer(id);
  redirect(`/customers/${id}?msg=${encodeURIComponent(inactive ? 'Pelanggan dinonaktifkan' : 'Pelanggan diaktifkan kembali')}`);
}

export async function generateCustomerInvoice(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const r = await generateInvoices({ customerId: id, force: true });
  revalidateCustomer(id);
  const msg = r.created.length
    ? `Invoice dibuat: ${r.created.join(', ')}`
    : 'Tidak ada invoice baru (sudah ada / belum waktunya)';
  redirect(`/customers/${id}?msg=${encodeURIComponent(msg)}`);
}

export async function importFromMikrotik(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const dueDay = int(fd, 'due_day');
  const isolirDay = int(fd, 'isolir_day');
  if (!(dueDay >= 1 && dueDay <= 31) || !(isolirDay >= 1 && isolirDay <= 31)) {
    return fail('Tanggal jatuh tempo & isolir harus 1–31');
  }
  const router = await getRouter(int(fd, 'router_id'));
  if (!router) return fail('Pilih router sumber impor');
  if (!isRouterUsable(router)) return fail(`Router ${router.name} sedang nonaktif, aktifkan dulu`);

  let secrets;
  try {
    secrets = await listSecrets(router);
  } catch (err) {
    return fail(`Gagal mengambil secret: ${(err as Error).message}`);
  }
  const packages = await query<{ id: number; mikrotik_profile: string }>('SELECT id, mikrotik_profile FROM packages');
  const byProfile = new Map(packages.map((p) => [p.mikrotik_profile.toLowerCase(), p.id]));
  const existing = new Set(
    (await query<{ pppoe_username: string }>('SELECT pppoe_username FROM customers')).map((r) => r.pppoe_username),
  );

  let imported = 0;
  const unmatched = new Set<string>();
  const today = todayStr();
  for (const sec of secrets) {
    if (sec.service && !['pppoe', 'any'].includes(sec.service)) continue;
    if (!sec.name || existing.has(sec.name)) continue;
    const isIsolir = sec.profile?.toLowerCase() === router.isolir_profile.toLowerCase();
    const pkgId = byProfile.get((sec.profile ?? '').toLowerCase());
    if (!pkgId) {
      unmatched.add(sec.profile || '(kosong)');
      continue;
    }
    await query(
      `INSERT INTO customers (name, pppoe_username, pppoe_password, package_id, active_date, due_day, isolir_day, status, notes, router_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        sec.comment || sec.name, sec.name, sec.password ?? '', pkgId, today, dueDay, isolirDay,
        sec.disabled === 'true' ? 'inactive' : isIsolir ? 'isolated' : 'active',
        `Diimpor dari MikroTik ${router.name}`, router.id,
      ],
    );
    imported++;
  }
  await logActivity('info', 'customer.import', `Import MikroTik [${router.name}]: ${imported} pelanggan ditambahkan`);
  revalidateCustomer();
  let msg = `${imported} pelanggan berhasil diimpor dari ${router.name}.`;
  if (unmatched.size) msg += ` Dilewati karena profile belum ada di Paket: ${[...unmatched].join(', ')}`;
  return imported || !unmatched.size ? ok(msg) : fail(msg);
}

export type ImportCsvResult = {
  ok: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: { line: number; message: string }[];
  importedNames: string[];
};

export async function importCustomersCsvAction(
  fd: FormData,
): Promise<ImportCsvResult> {
  await verifySession();
  const file = fd.get('csv_file') as File | null;
  const rawText = str(fd, 'csv_text');
  const syncMikrotik = fd.get('sync_mikrotik') === 'on' || fd.get('sync_mikrotik') === 'true';
  const autoCreatePackage = fd.get('auto_create_package') === 'on' || fd.get('auto_create_package') === 'true';
  const router = await getRouter(int(fd, 'router_id'));

  let content = '';
  if (file && file.size > 0) {
    content = await file.text();
  } else if (rawText) {
    content = rawText;
  }

  if (!content.trim()) {
    return {
      ok: false,
      total: 0,
      imported: 0,
      failed: 0,
      errors: [{ line: 0, message: 'File CSV kosong atau belum dipilih' }],
      importedNames: [],
    };
  }

  const rows = parseCsv(content);
  if (rows.length < 2) {
    return {
      ok: false,
      total: 0,
      imported: 0,
      failed: 0,
      errors: [{ line: 1, message: 'File CSV harus memiliki baris judul kolom dan minimal 1 baris data' }],
      importedNames: [],
    };
  }

  const headerRow = rows[0].map((h) => h.toLowerCase().trim());
  const findCol = (...keywords: string[]) => {
    return headerRow.findIndex((h) => keywords.some((k) => h.includes(k)));
  };

  const nameIdx = findCol('nama', 'name');
  const phoneIdx = findCol('hp', 'telepon', 'whatsapp', 'phone', 'wa');
  const addrIdx = findCol('alamat', 'address');
  const userIdx = findCol('username', 'user', 'pppoe');
  const passIdx = findCol('password', 'pass', 'sandi');
  const pkgIdx = findCol('paket', 'package', 'profil');
  const activeIdx = findCol('aktif', 'active');
  const dueIdx = findCol('tempo', 'due');
  const isolirIdx = findCol('isolir');
  const notesIdx = findCol('catatan', 'note', 'keterangan');
  const billingTypeIdx = findCol('tipe', 'sistem', 'billing', 'prabayar', 'pascabayar');

  if (nameIdx === -1 || userIdx === -1) {
    return {
      ok: false,
      total: 0,
      imported: 0,
      failed: 0,
      errors: [{ line: 1, message: 'Header CSV harus memiliki minimal kolom Nama Pelanggan dan PPPoE Username' }],
      importedNames: [],
    };
  }

  const pkgs = await query<{ id: number; name: string; mikrotik_profile: string; price: number }>(
    'SELECT id, name, mikrotik_profile, price FROM packages'
  );
  const pkgMap = new Map<string, typeof pkgs[0]>();
  for (const p of pkgs) {
    pkgMap.set(p.name.toLowerCase().trim(), p);
    pkgMap.set(p.mikrotik_profile.toLowerCase().trim(), p);
  }

  const existingUsers = new Set<string>(
    (await query<{ pppoe_username: string }>('SELECT pppoe_username FROM customers')).map((c) =>
      c.pppoe_username.toLowerCase()
    )
  );

  const today = todayStr();
  const errors: { line: number; message: string }[] = [];
  const importedNames: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 1;

    const name = (nameIdx !== -1 ? row[nameIdx] : '') || '';
    const phone = (phoneIdx !== -1 ? row[phoneIdx] : '') || '';
    const address = (addrIdx !== -1 ? row[addrIdx] : '') || '';
    const username = (userIdx !== -1 ? row[userIdx] : '') || '';
    const password = (passIdx !== -1 ? row[passIdx] : '') || '123456';
    const pkgName = (pkgIdx !== -1 ? row[pkgIdx] : '') || 'Default';
    const bTypeRaw = (billingTypeIdx !== -1 ? row[billingTypeIdx] : '').toLowerCase();
    const billingType = bTypeRaw.includes('pasca') || bTypeRaw.includes('post') ? 'postpaid' : 'prepaid';
    const activeDateRaw = (activeIdx !== -1 ? row[activeIdx] : '') || today;
    const dueDayRaw = dueIdx !== -1 ? parseInt(row[dueIdx], 10) : 10;
    const isolirDayRaw = isolirIdx !== -1 ? parseInt(row[isolirIdx], 10) : 15;
    const notes = (notesIdx !== -1 ? row[notesIdx] : '') || '';

    if (!name.trim()) {
      errors.push({ line: lineNum, message: 'Nama pelanggan kosong' });
      continue;
    }
    if (!username.trim()) {
      errors.push({ line: lineNum, message: 'Username PPPoE kosong' });
      continue;
    }

    const cleanUsername = username.trim();
    if (existingUsers.has(cleanUsername.toLowerCase())) {
      errors.push({ line: lineNum, message: `Username PPPoE '${cleanUsername}' sudah terdaftar` });
      continue;
    }

    let pkg = pkgMap.get(pkgName.toLowerCase().trim());
    if (!pkg && autoCreatePackage && pkgName.trim()) {
      const newPkg = await queryOne<{ id: number; name: string; mikrotik_profile: string; price: number }>(
        `INSERT INTO packages (name, price, mikrotik_profile, description)
         VALUES ($1, 150000, $2, 'Dibuat otomatis dari import CSV')
         RETURNING id, name, mikrotik_profile, price`,
        [pkgName.trim(), pkgName.trim()]
      );
      if (newPkg) {
        pkg = newPkg;
        pkgMap.set(pkgName.toLowerCase().trim(), pkg);
      }
    }

    if (!pkg) {
      if (pkgs.length > 0) {
        pkg = pkgs[0];
      } else {
        errors.push({ line: lineNum, message: `Paket '${pkgName}' tidak ditemukan` });
        continue;
      }
    }

    let activeDate = today;
    if (/^\d{4}-\d{2}-\d{2}$/.test(activeDateRaw)) {
      activeDate = activeDateRaw;
    }

    const dueDay = isNaN(dueDayRaw) || dueDayRaw < 1 || dueDayRaw > 31 ? 10 : dueDayRaw;
    const isolirDay = isNaN(isolirDayRaw) || isolirDayRaw < 1 || isolirDayRaw > 31 ? 15 : isolirDayRaw;

    try {
      const res = await queryOne<{ id: number; code: string }>(
        `INSERT INTO customers (
          name, phone, address, pppoe_username, pppoe_password, package_id,
          billing_type, active_date, due_day, isolir_day, status, notes, router_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12)
        RETURNING id, code`,
        [
          name.trim(),
          phone.trim() || null,
          address.trim() || null,
          cleanUsername,
          password.trim(),
          pkg.id,
          billingType,
          activeDate,
          dueDay,
          isolirDay,
          notes.trim() || 'Import CSV',
          router?.id ?? null,
        ]
      );

      if (res) {
        existingUsers.add(cleanUsername.toLowerCase());
        importedNames.push(`${name.trim()} (${cleanUsername})`);

        if (syncMikrotik && isRouterUsable(router)) {
          try {
            await upsertSecret(router, {
              username: cleanUsername,
              password: password.trim(),
              profile: pkg.mikrotik_profile,
              comment: `${name.trim()} (${res.code})`,
            });
          } catch {
            // Router sync failure logged silently without failing DB insert
          }
        }
      }
    } catch (dbErr) {
      errors.push({ line: lineNum, message: dbErr instanceof Error ? dbErr.message : 'Gagal simpan ke database' });
    }
  }

  if (importedNames.length > 0) {
    await logActivity(
      'info',
      'customer.import_csv',
      `Import CSV: Berhasil menambahkan ${importedNames.length} pelanggan baru.`
    );
    revalidateCustomer();
  }

  return {
    ok: importedNames.length > 0,
    total: rows.length - 1,
    imported: importedNames.length,
    failed: errors.length,
    errors,
    importedNames,
  };
}
