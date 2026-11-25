'use server';

import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/dal';
import { ActionState, fail, ok, str } from '@/lib/action-state';
import { setSettings } from '@/lib/settings';
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
