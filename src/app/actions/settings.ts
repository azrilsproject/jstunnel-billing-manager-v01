'use server';

import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/dal';
import { ActionState, fail, ok, str } from '@/lib/action-state';
import { setSettings } from '@/lib/settings';
import { testConnection } from '@/lib/mikrotik';
import { logActivity } from '@/lib/logs';

export async function saveCompanySettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const company_name = str(fd, 'company_name');
  const company_phone = str(fd, 'company_phone');
  const company_address = str(fd, 'company_address');
  const bank_info = str(fd, 'bank_info');
  const invoice_days_before = str(fd, 'invoice_days_before') || '7';
  const auto_isolir = fd.get('auto_isolir') === 'on' ? 'true' : 'false';

  if (!company_name) return fail('Nama perusahaan / usaha wajib diisi');

  await setSettings({
    company_name,
    company_phone,
    company_address,
    bank_info,
    invoice_days_before,
    auto_isolir,
  });

  await logActivity('info', 'settings.company', 'Pengaturan usaha & billing disimpan');
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return ok('Pengaturan usaha berhasil disimpan');
}

export async function saveMikrotikSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const mikrotik_enabled = fd.get('mikrotik_enabled') === 'on' ? 'true' : 'false';
  const mikrotik_host = str(fd, 'mikrotik_host');
  const mikrotik_port = str(fd, 'mikrotik_port') || '8728';
  const mikrotik_tls = fd.get('mikrotik_tls') === 'on' ? 'true' : 'false';
  const mikrotik_user = str(fd, 'mikrotik_user');
  const mikrotik_password = str(fd, 'mikrotik_password');
  const isolir_profile = str(fd, 'isolir_profile') || 'ISOLIR';

  if (mikrotik_enabled === 'true' && (!mikrotik_host || !mikrotik_user)) {
    return fail('Host dan User MikroTik wajib diisi jika integrasi diaktifkan');
  }

  await setSettings({
    mikrotik_enabled,
    mikrotik_host,
    mikrotik_port,
    mikrotik_tls,
    mikrotik_user,
    mikrotik_password,
    isolir_profile,
  });

  await logActivity('info', 'settings.mikrotik', `Pengaturan MikroTik diperbarui (${mikrotik_host})`);
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return ok('Pengaturan MikroTik berhasil disimpan');
}

export async function testMikrotikConnectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await verifySession();
  const host = str(fd, 'mikrotik_host');
  const port = str(fd, 'mikrotik_port') || '8728';
  const user = str(fd, 'mikrotik_user');
  const password = str(fd, 'mikrotik_password');
  const tls = fd.get('mikrotik_tls') === 'on' ? 'true' : 'false';

  if (!host || !user) return fail('Host dan User MikroTik wajib diisi untuk tes koneksi');

  try {
    const res = await testConnection({
      mikrotik_host: host,
      mikrotik_port: port,
      mikrotik_user: user,
      mikrotik_password: password,
      mikrotik_tls: tls,
    });
    return ok(
      `Terkoneksi ke MikroTik "${res.identity}" | Board: ${res.board} | Ver: ${res.version} | Uptime: ${res.uptime} | Profil PPP: ${res.profiles.join(', ')}`,
    );
  } catch (err) {
    return fail(`Koneksi Gagal: ${(err as Error).message}`);
  }
}
