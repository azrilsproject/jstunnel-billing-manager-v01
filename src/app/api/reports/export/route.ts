import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { todayStr, formatDate, formatDateTime, periodLabel } from '@/lib/dates';
import { serializeCsv } from '@/lib/csv';

export async function GET(req: NextRequest) {
  try {
    await verifySession();

    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get('period') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const status = searchParams.get('status') || '';
    const method = searchParams.get('method') || '';
    const billingType = searchParams.get('billing_type') || '';

    let where = '1=1';
    const params: unknown[] = [];

    if (period) {
      params.push(period + '-01');
      where += ` AND i.period = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      where += ` AND i.issue_date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      where += ` AND i.issue_date <= $${params.length}`;
    }

    if (status && ['paid', 'unpaid', 'void'].includes(status)) {
      params.push(status);
      where += ` AND i.status = $${params.length}`;
    }

    if (method) {
      params.push(method);
      where += ` AND i.payment_method = $${params.length}`;
    }

    if (billingType && ['prepaid', 'postpaid'].includes(billingType)) {
      params.push(billingType);
      where += ` AND c.billing_type = $${params.length}`;
    }

    const invoices = await query<{
      number: string;
      status: string;
      period: string;
      customer_name: string;
      customer_code: string;
      pppoe_username: string;
      billing_type: string;
      package_name: string;
      amount: number;
      issue_date: string;
      due_date: string;
      paid_at: string | null;
      payment_method: string | null;
      admin_name: string | null;
      notes: string | null;
    }>(`
      SELECT 
        i.number, i.status, i.period, i.package_name, i.amount,
        i.issue_date, i.due_date, i.paid_at, i.payment_method, i.notes,
        c.name AS customer_name, c.code AS customer_code, c.pppoe_username, c.billing_type,
        a.name AS admin_name
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      LEFT JOIN admins a ON a.id = i.paid_by
      WHERE ${where}
      ORDER BY (CASE WHEN i.paid_at IS NOT NULL THEN i.paid_at ELSE i.created_at END) DESC
    `, params);

    const headers = [
      'Nomor Invoice',
      'Status',
      'Periode Tagihan',
      'Kode Pelanggan',
      'Nama Pelanggan',
      'PPPoE Username',
      'Sistem Tagihan',
      'Paket Internet',
      'Nominal (Rp)',
      'Tanggal Terbit',
      'Tanggal Jatuh Tempo',
      'Tanggal Pembayaran',
      'Metode Pembayaran',
      'Petugas Admin',
      'Catatan',
    ];

    const rows = invoices.map((inv) => [
      inv.number,
      inv.status === 'paid' ? 'LUNAS' : inv.status === 'unpaid' ? 'BELUM BAYAR' : 'BATAL',
      periodLabel(inv.period),
      inv.customer_code,
      inv.customer_name,
      inv.pppoe_username,
      inv.billing_type === 'postpaid' ? 'Pascabayar' : 'Prabayar',
      inv.package_name,
      inv.amount,
      formatDate(inv.issue_date),
      formatDate(inv.due_date),
      inv.paid_at ? formatDateTime(inv.paid_at) : '-',
      inv.payment_method || '-',
      inv.admin_name || '-',
      inv.notes || '',
    ]);

    const csvContent = serializeCsv(headers, rows);
    const filename = `laporan_keuangan_${period || todayStr()}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return new Response('Unauthorized or Export Failed', { status: 401 });
  }
}
