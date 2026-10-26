import { formatDateLong, periodLabel } from './dates';
import { rupiah } from './format';

/**
 * Format nomor telepon Indonesia ke format internasional (contoh: 08123456789 -> 628123456789)
 */
export function formatPhoneNumberForWa(phone: string | null | undefined): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('+62')) {
    clean = clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  return clean;
}

export type InvoiceWaData = {
  customerName: string;
  customerPhone: string | null;
  invoiceNumber: string;
  period: string | Date;
  packageName: string;
  amount: number;
  dueDate: string | Date;
  isolirDate: string | Date;
  status: 'unpaid' | 'paid' | 'void';
  companyName: string;
  bankInfo: string;
};

/**
 * Buat link URL wa.me dengan pesan tagihan siap kirim
 */
export function createInvoiceWaLink(data: InvoiceWaData): string {
  const phone = formatPhoneNumberForWa(data.customerPhone);
  const statusLabel =
    data.status === 'paid' ? '✅ LUNAS' : data.status === 'unpaid' ? '⏳ BELUM BAYAR' : 'DIBATALKAN';

  const message = [
    `Halo Yth. Bpk/Ibu *${data.customerName}*,`,
    `Berikut rincian tagihan internet PPPoE Anda dari *${data.companyName || 'JAMES NET'}*:`,
    '',
    `📄 *No. Invoice:* ${data.invoiceNumber}`,
    `📅 *Periode:* ${periodLabel(data.period)}`,
    `⚡ *Paket:* ${data.packageName}`,
    `💰 *Total Tagihan:* ${rupiah(data.amount)}`,
    `⏰ *Jatuh Tempo:* ${formatDateLong(data.dueDate)}`,
    `🛡️ *Batas Isolir:* ${formatDateLong(data.isolirDate)}`,
    `📌 *Status:* ${statusLabel}`,
    '',
    data.status === 'unpaid'
      ? `💳 *Pembayaran dapat ditransfer melalui:*\n${data.bankInfo || 'Silakan hubungi admin.'}\n\n⚠️ *Perhatian:* Layanan akan terisolir otomatis jika pembayaran melewati tanggal ${formatDateLong(data.isolirDate)}.`
      : `Terima kasih atas pembayaran tagihan internet Anda. Layanan tetap aktif normal.`,
    '',
    `Jika ada kendala koneksi atau konfirmasi pembayaran, silakan balas pesan ini. Terima kasih!`,
  ].join('\n');

  if (!phone) {
    // Jika tidak ada nomor HP, buka wa.me dengan teks saja
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
