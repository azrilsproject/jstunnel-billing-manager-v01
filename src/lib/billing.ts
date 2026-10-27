import 'server-only';
import { query, queryOne, transaction } from './db';
import { addDays, addMonths, computeSchedule, parseDate, todayStr, periodLabel } from './dates';
import { logActivity } from './logs';
import { getSettings, setSettings, Settings } from './settings';
import {
  isMikrotikEnabled,
  setSecretProfile,
  setSecretDisabled,
  upsertSecret,
} from './mikrotik';

export type CustomerWithPackage = {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  pppoe_username: string;
  pppoe_password: string;
  status: 'active' | 'isolated' | 'inactive';
  billing_type: 'prepaid' | 'postpaid';
  active_date: string;
  due_day: number;
  isolir_day: number;
  notes: string | null;
  package_id: number;
  package_name: string;
  price: number;
  mikrotik_profile: string;
};

const CUSTOMER_SELECT = `
  SELECT c.*, p.name AS package_name, p.price, p.mikrotik_profile
  FROM customers c JOIN packages p ON p.id = c.package_id`;

export async function getCustomer(id: number) {
  return queryOne<CustomerWithPackage>(`${CUSTOMER_SELECT} WHERE c.id = $1`, [id]);
}

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/* ------------------------------------------------------------------ */
/* Invoice generation                                                  */
/* ------------------------------------------------------------------ */

export function invoiceNumber(period: string, customerCode: string) {
  const { y, m } = parseDate(period);
  return `INV-${y}${String(m).padStart(2, '0')}-${customerCode}`;
}

type GenerateOpts = {
  today?: string;
  customerId?: number;
  /** Paksa buat invoice bulan berjalan walau belum masuk H-x */
  force?: boolean;
};

/**
 * Buat invoice bulanan.
 * Mendukung model:
 * - Prabayar (Prepaid): ditagihkan di muka pada tanggal mulai aktif (periode bulan aktif).
 * - Pascabayar (Postpaid): pemakaian dulu, tagihan pertama baru terbit bulan depan.
 */
export async function generateInvoices(opts: GenerateOpts = {}) {
  const today = opts.today ?? todayStr();
  const settings = await getSettings();
  const daysBefore = Math.max(0, Number(settings.invoice_days_before) || 0);

  const params: unknown[] = [];
  let where = `c.status IN ('active', 'isolated')`;
  if (opts.customerId) {
    params.push(opts.customerId);
    where += ` AND c.id = $${params.length}`;
  }
  const customers = await query<CustomerWithPackage>(`${CUSTOMER_SELECT} WHERE ${where}`, params);

  const { y, m } = parseDate(today);
  const created: string[] = [];

  for (const c of customers) {
    const activeYM = parseDate(c.active_date);

    for (const offset of [0, 1]) {
      const ym = addMonths(y, m, offset);
      const isActivationMonth = ym.y === activeYM.y && ym.m === activeYM.m;

      // Aturan Pascabayar: ditagihkan bulan depan (bulan setelah mulai aktif)
      if (c.billing_type === 'postpaid') {
        if (isActivationMonth && !opts.force) {
          continue;
        }
      }

      const sched = computeSchedule(ym.y, ym.m, c.due_day, c.isolir_day);

      // Aturan Prabayar: ditagihkan di tanggal mulai aktif
      let dueDate = sched.dueDate;
      let isolirDate = sched.isolirDate;
      if (isActivationMonth && c.billing_type !== 'postpaid') {
        if (dueDate < c.active_date) {
          dueDate = c.active_date;
          if (isolirDate <= dueDate) {
            const gap = c.isolir_day >= c.due_day ? c.isolir_day - c.due_day : 5;
            isolirDate = addDays(c.active_date, Math.max(1, gap));
          }
        }
      } else if (sched.dueDate < c.active_date) {
        continue;
      }

      const windowOpen = today >= addDays(dueDate, -daysBefore);
      const forced = opts.force && offset === 0;
      if (!windowOpen && !forced) continue;

      const number = invoiceNumber(sched.period, c.code);
      const res = await query<{ number: string }>(
        `INSERT INTO invoices (number, customer_id, period, package_name, amount, issue_date, due_date, isolir_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (customer_id, period) DO NOTHING
         RETURNING number`,
        [number, c.id, sched.period, c.package_name, c.price, today, dueDate, isolirDate],
      );
      if (res.length) {
        created.push(number);
        const tipeStr = c.billing_type === 'postpaid' ? 'Pascabayar' : 'Prabayar';
        await logActivity(
          'info',
          'invoice.create',
          `Invoice ${number} (${periodLabel(sched.period)}) dibuat untuk ${c.name} [${tipeStr}]`,
          c.id,
        );
      }
    }
  }
  return { created };
}

export type ManualInvoiceParams = {
  customerId: number;
  period: string;
  packageName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  isolirDate: string;
  status: 'unpaid' | 'paid';
  paymentMethod?: string | null;
  notes?: string | null;
  adminId?: number | null;
};

export async function createManualInvoice(params: ManualInvoiceParams) {
  const c = await getCustomer(params.customerId);
  if (!c) return { ok: false, message: 'Pelanggan tidak ditemukan' };

  const { y, m } = parseDate(params.period);
  const periodDate = `${y}-${String(m).padStart(2, '0')}-01`;

  const existing = await queryOne<{ id: number; number: string }>(
    `SELECT id, number FROM invoices WHERE customer_id = $1 AND period = $2`,
    [c.id, periodDate],
  );
  if (existing) {
    return {
      ok: false,
      message: `Invoice untuk periode ${periodLabel(periodDate)} sudah ada dengan nomor ${existing.number}.`,
    };
  }

  let number = invoiceNumber(periodDate, c.code);
  const checkDupNum = await queryOne<{ id: number }>('SELECT id FROM invoices WHERE number = $1', [number]);
  if (checkDupNum) {
    number = `${number}-M`;
  }

  const isPaid = params.status === 'paid';
  const res = await query<{ id: number; number: string }>(
    `INSERT INTO invoices (
      number, customer_id, period, package_name, amount, issue_date, due_date, isolir_date,
      status, paid_at, payment_method, paid_by, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id, number`,
    [
      number,
      c.id,
      periodDate,
      params.packageName.trim(),
      params.amount,
      params.issueDate,
      params.dueDate,
      params.isolirDate,
      params.status,
      isPaid ? new Date() : null,
      isPaid ? (params.paymentMethod || 'Cash') : null,
      isPaid ? params.adminId : null,
      params.notes?.trim() || null,
    ],
  );

  const inv = res[0];
  await logActivity(
    isPaid ? 'success' : 'info',
    'invoice.create_manual',
    `Invoice manual ${inv.number} (${periodLabel(periodDate)} - Rp ${params.amount.toLocaleString('id-ID')}) dibuat untuk ${c.name}${isPaid ? ' (Langsung Lunas)' : ''}`,
    c.id,
  );

  if (isPaid) {
    await restoreIfClear(c.id, `Pembayaran invoice manual ${inv.number}`);
  }

  return { ok: true, invoice: inv };
}

/* ------------------------------------------------------------------ */
/* Isolir / buka isolir                                                */
/* ------------------------------------------------------------------ */

export async function isolateCustomer(customerId: number, reason: string, settings?: Settings) {
  const s = settings ?? (await getSettings());
  const c = await getCustomer(customerId);
  if (!c) return { ok: false, message: 'Pelanggan tidak ditemukan' };
  if (c.status === 'inactive') return { ok: false, message: 'Pelanggan berstatus berhenti' };

  if (isMikrotikEnabled(s)) {
    try {
      const { kicked } = await setSecretProfile(c.pppoe_username, s.isolir_profile);
      await logActivity(
        'warning',
        'mikrotik.isolir',
        `${c.name} (${c.pppoe_username}) diisolir → profile ${s.isolir_profile}${kicked ? ', sesi diputus' : ''}. ${reason}`,
        c.id,
      );
    } catch (err) {
      await logActivity('error', 'mikrotik.isolir', `Gagal isolir ${c.pppoe_username}: ${errMsg(err)}`, c.id);
      return { ok: false, message: `Gagal isolir di MikroTik: ${errMsg(err)}` };
    }
  } else {
    await logActivity('warning', 'isolir', `${c.name} ditandai terisolir (MikroTik nonaktif). ${reason}`, c.id);
  }

  await query(`UPDATE customers SET status = 'isolated', updated_at = now() WHERE id = $1`, [c.id]);
  return { ok: true, message: `${c.name} berhasil diisolir` };
}

export async function restoreCustomer(customerId: number, reason: string, settings?: Settings) {
  const s = settings ?? (await getSettings());
  const c = await getCustomer(customerId);
  if (!c) return { ok: false, message: 'Pelanggan tidak ditemukan' };

  if (isMikrotikEnabled(s)) {
    try {
      const { kicked } = await setSecretProfile(c.pppoe_username, c.mikrotik_profile);
      await logActivity(
        'success',
        'mikrotik.restore',
        `${c.name} (${c.pppoe_username}) dibuka → profile ${c.mikrotik_profile}${kicked ? ', sesi diputus' : ''}. ${reason}`,
        c.id,
      );
    } catch (err) {
      await logActivity('error', 'mikrotik.restore', `Gagal buka isolir ${c.pppoe_username}: ${errMsg(err)}`, c.id);
      return { ok: false, message: `Gagal buka isolir di MikroTik: ${errMsg(err)}` };
    }
  } else {
    await logActivity('success', 'restore', `${c.name} diaktifkan kembali (MikroTik nonaktif). ${reason}`, c.id);
  }

  await query(`UPDATE customers SET status = 'active', updated_at = now() WHERE id = $1`, [c.id]);
  return { ok: true, message: `${c.name} berhasil diaktifkan kembali` };
}

async function overdueCount(customerId: number, today: string) {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM invoices
     WHERE customer_id = $1 AND status = 'unpaid' AND isolir_date <= $2`,
    [customerId, today],
  );
  return row?.n ?? 0;
}

/** Buka isolir otomatis jika sudah tidak ada tunggakan yang lewat tanggal isolir */
export async function restoreIfClear(customerId: number, reason: string) {
  const c = await queryOne<{ status: string }>('SELECT status FROM customers WHERE id = $1', [customerId]);
  if (c?.status !== 'isolated') return null;
  if ((await overdueCount(customerId, todayStr())) > 0) return null;
  return restoreCustomer(customerId, reason);
}

/* ------------------------------------------------------------------ */
/* Pembayaran                                                          */
/* ------------------------------------------------------------------ */

export async function markInvoicePaid(
  invoiceId: number,
  method: string,
  adminId: number | null,
  notes?: string,
) {
  const inv = await transaction(async (db) => {
    const { rows } = await db.query(
      `UPDATE invoices SET status = 'paid', paid_at = now(), payment_method = $2, paid_by = $3,
              notes = COALESCE(NULLIF($4, ''), notes)
       WHERE id = $1 AND status = 'unpaid'
       RETURNING id, number, customer_id, amount`,
      [invoiceId, method, adminId, notes ?? ''],
    );
    return rows[0] as { id: number; number: string; customer_id: number; amount: number } | undefined;
  });
  if (!inv) return { ok: false, message: 'Invoice tidak ditemukan atau sudah lunas' };

  await logActivity('success', 'invoice.paid', `Invoice ${inv.number} dibayar (${method})`, inv.customer_id);
  const restored = await restoreIfClear(inv.customer_id, `Pembayaran ${inv.number}`);
  return {
    ok: true,
    message: `Invoice ${inv.number} ditandai lunas` + (restored?.ok ? ' & layanan dibuka kembali' : ''),
  };
}

export async function cancelPayment(invoiceId: number) {
  const inv = await queryOne<{ number: string; customer_id: number }>(
    `UPDATE invoices SET status = 'unpaid', paid_at = NULL, payment_method = NULL, paid_by = NULL
     WHERE id = $1 AND status = 'paid' RETURNING number, customer_id`,
    [invoiceId],
  );
  if (!inv) return { ok: false, message: 'Invoice tidak dalam status lunas' };
  await logActivity('warning', 'invoice.unpaid', `Pembayaran ${inv.number} dibatalkan`, inv.customer_id);
  return { ok: true, message: `Pembayaran ${inv.number} dibatalkan` };
}

export async function voidInvoice(invoiceId: number) {
  const inv = await queryOne<{ number: string; customer_id: number }>(
    `UPDATE invoices SET status = 'void' WHERE id = $1 AND status = 'unpaid' RETURNING number, customer_id`,
    [invoiceId],
  );
  if (!inv) return { ok: false, message: 'Hanya invoice belum bayar yang bisa dibatalkan' };
  await logActivity('warning', 'invoice.void', `Invoice ${inv.number} dibatalkan`, inv.customer_id);
  await restoreIfClear(inv.customer_id, `Invoice ${inv.number} dibatalkan`);
  return { ok: true, message: `Invoice ${inv.number} dibatalkan` };
}

export async function deleteInvoice(invoiceId: number) {
  const inv = await queryOne<{ number: string; customer_id: number; status: string }>(
    `SELECT number, customer_id, status FROM invoices WHERE id = $1`,
    [invoiceId],
  );
  if (!inv) return { ok: false, message: 'Invoice tidak ditemukan' };
  await query(`DELETE FROM invoices WHERE id = $1`, [invoiceId]);
  await logActivity('warning', 'invoice.delete', `Invoice ${inv.number} dihapus`, inv.customer_id);
  if (inv.status === 'unpaid') {
    await restoreIfClear(inv.customer_id, `Invoice ${inv.number} dihapus`);
  }
  return { ok: true, message: `Invoice ${inv.number} dihapus` };
}


/* ------------------------------------------------------------------ */
/* Siklus otomatis                                                     */
/* ------------------------------------------------------------------ */

export async function runIsolirCheck(today = todayStr()) {
  const s = await getSettings();
  const result = { isolated: 0, restored: 0, failed: 0 };

  if (s.auto_isolir === 'true') {
    const due = await query<{ id: number; name: string; numbers: string }>(
      `SELECT c.id, c.name, string_agg(i.number, ', ') AS numbers
       FROM customers c JOIN invoices i ON i.customer_id = c.id
       WHERE c.status = 'active' AND i.status = 'unpaid' AND i.isolir_date <= $1
       GROUP BY c.id, c.name`,
      [today],
    );
    for (const c of due) {
      const r = await isolateCustomer(c.id, `Tunggakan: ${c.numbers}`, s);
      if (r.ok) result.isolated++;
      else result.failed++;
    }
  }

  // Jaring pengaman: pelanggan terisolir yang tunggakannya sudah beres
  const clear = await query<{ id: number }>(
    `SELECT c.id FROM customers c
     WHERE c.status = 'isolated' AND NOT EXISTS (
       SELECT 1 FROM invoices i WHERE i.customer_id = c.id AND i.status = 'unpaid' AND i.isolir_date <= $1
     )`,
    [today],
  );
  for (const c of clear) {
    const r = await restoreCustomer(c.id, 'Tidak ada tunggakan', s);
    if (r.ok) result.restored++;
    else result.failed++;
  }
  return result;
}

const g = globalThis as unknown as { billingCycleRunning?: boolean };

export async function runBillingCycle(source = 'scheduler') {
  if (g.billingCycleRunning) return { skipped: true as const };
  g.billingCycleRunning = true;
  try {
    const today = todayStr();
    const gen = await generateInvoices({ today });
    const iso = await runIsolirCheck(today);
    const summary =
      `${gen.created.length} invoice baru, ${iso.isolated} diisolir, ` +
      `${iso.restored} dibuka, ${iso.failed} gagal`;
    await setSettings({ last_cycle_at: new Date().toISOString(), last_cycle_summary: summary });
    if (gen.created.length || iso.isolated || iso.restored || iso.failed) {
      await logActivity(iso.failed ? 'warning' : 'info', 'cycle', `Siklus billing (${source}): ${summary}`);
    }
    return { skipped: false as const, created: gen.created.length, ...iso, summary };
  } finally {
    g.billingCycleRunning = false;
  }
}

/* ------------------------------------------------------------------ */
/* Sinkronisasi pelanggan ke MikroTik                                  */
/* ------------------------------------------------------------------ */

export async function syncCustomerToMikrotik(customerId: number, previousUsername?: string) {
  const s = await getSettings();
  if (!isMikrotikEnabled(s)) return { ok: true, skipped: true, message: 'MikroTik nonaktif, hanya disimpan di database' };
  const c = await getCustomer(customerId);
  if (!c) return { ok: false, message: 'Pelanggan tidak ditemukan' };
  try {
    const profile = c.status === 'isolated' ? s.isolir_profile : c.mikrotik_profile;
    const r = await upsertSecret({
      username: c.pppoe_username,
      password: c.pppoe_password,
      profile,
      comment: `${c.code} - ${c.name}`,
      disabled: c.status === 'inactive',
      previousUsername,
    });
    await logActivity('info', 'mikrotik.sync', `Secret ${c.pppoe_username} ${r === 'created' ? 'dibuat' : 'diperbarui'} (profile ${profile})`, c.id);
    return { ok: true, message: `Secret PPPoE ${r === 'created' ? 'dibuat' : 'diperbarui'} di MikroTik` };
  } catch (err) {
    await logActivity('error', 'mikrotik.sync', `Gagal sync ${c.pppoe_username}: ${errMsg(err)}`, c.id);
    return { ok: false, message: `Tersimpan di database, tapi gagal sync MikroTik: ${errMsg(err)}` };
  }
}

export async function setCustomerInactiveOnRouter(username: string, inactive: boolean) {
  const s = await getSettings();
  if (!isMikrotikEnabled(s)) return;
  try {
    await setSecretDisabled(username, inactive);
  } catch (err) {
    await logActivity('error', 'mikrotik.disable', `Gagal ${inactive ? 'disable' : 'enable'} ${username}: ${errMsg(err)}`);
  }
}
