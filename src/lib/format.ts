export function rupiah(n: number | null | undefined): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n ?? 0);
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type CustomerStatus = 'active' | 'isolated' | 'inactive';
export type InvoiceStatus = 'unpaid' | 'paid' | 'void';

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  active: 'Aktif',
  isolated: 'Terisolir',
  inactive: 'Berhenti',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  unpaid: 'Belum Bayar',
  paid: 'Lunas',
  void: 'Dibatalkan',
};
