'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { ActionState, fail, int, str } from '@/lib/action-state';
import { todayStr } from '@/lib/dates';
import {
  cancelPayment,
  createManualInvoice,
  generateInvoices,
  markInvoicePaid,
  runBillingCycle,
  voidInvoice,
  deleteInvoice,
} from '@/lib/billing';

export async function payInvoice(fd: FormData): Promise<void> {
  const session = await verifySession();
  const id = int(fd, 'id');
  const method = str(fd, 'payment_method') || 'Cash';
  const notes = str(fd, 'notes');

  await markInvoicePaid(id, method, session.adminId, notes);
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  revalidatePath('/dashboard');
  revalidatePath('/customers');
}

export async function unpayInvoice(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  await cancelPayment(id);
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  revalidatePath('/dashboard');
  revalidatePath('/customers');
}

export async function cancelInvoiceAction(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  await voidInvoice(id);
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  revalidatePath('/dashboard');
  revalidatePath('/customers');
}

export async function deleteInvoiceAction(fd: FormData): Promise<void> {
  await verifySession();
  const id = int(fd, 'id');
  const redirectTo = str(fd, 'redirect_to');
  await deleteInvoice(id);
  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  revalidatePath('/customers');
  if (redirectTo) {
    redirect(redirectTo);
  }
}

export async function triggerBillingCycle(): Promise<void> {
  await verifySession();
  await runBillingCycle('manual_admin');
  revalidatePath('/dashboard');
  revalidatePath('/invoices');
  revalidatePath('/customers');
}

export async function triggerGenerateInvoices(): Promise<void> {
  await verifySession();
  await generateInvoices({ force: true });
  revalidatePath('/invoices');
  revalidatePath('/dashboard');
}

export async function createManualInvoiceAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const session = await verifySession();
  const customerId = int(fd, 'customer_id');
  const period = str(fd, 'period');
  const packageName = str(fd, 'package_name');
  const amount = int(fd, 'amount');
  const issueDate = str(fd, 'issue_date') || todayStr();
  const dueDate = str(fd, 'due_date');
  const isolirDate = str(fd, 'isolir_date');
  const status = (str(fd, 'status') || 'unpaid') as 'unpaid' | 'paid';
  const paymentMethod = str(fd, 'payment_method');
  const notes = str(fd, 'notes');

  const errors: Record<string, string> = {};
  if (!customerId) errors.customer_id = 'Pilih pelanggan';
  if (!period) errors.period = 'Pilih bulan/periode';
  if (!packageName) errors.package_name = 'Nama paket / item wajib diisi';
  if (isNaN(amount) || amount < 0) errors.amount = 'Nominal harus >= 0';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) errors.issue_date = 'Format tanggal terbit YYYY-MM-DD';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) errors.due_date = 'Format tanggal jatuh tempo YYYY-MM-DD';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isolirDate)) errors.isolir_date = 'Format tanggal isolir YYYY-MM-DD';

  if (Object.keys(errors).length > 0) {
    return fail('Mohon periksa kembali isian formulir', errors);
  }

  const res = await createManualInvoice({
    customerId,
    period,
    packageName,
    amount,
    issueDate,
    dueDate,
    isolirDate,
    status,
    paymentMethod,
    notes,
    adminId: session.adminId,
  });

  if (!res.ok || !res.invoice) {
    return fail(res.message || 'Gagal membuat invoice');
  }

  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  revalidatePath(`/customers/${customerId}`);
  redirect(`/invoices/${res.invoice.id}`);
}
