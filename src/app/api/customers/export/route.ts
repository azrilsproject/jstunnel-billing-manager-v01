import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/dal';
import { query } from '@/lib/db';
import { todayStr, formatDate } from '@/lib/dates';
import { serializeCsv } from '@/lib/csv';

export async function GET(_req: NextRequest) {
  try {
    await verifySession();

    const customers = await query<{
      code: string;
      name: string;
      phone: string | null;
      address: string | null;
      pppoe_username: string;
      pppoe_password: string;
      package_name: string;
      package_price: number;
      active_date: string;
      due_day: number;
      isolir_day: number;
      status: string;
      notes: string | null;
    }>(`
      SELECT 
        c.code, c.name, c.phone, c.address, c.pppoe_username, c.pppoe_password,
        p.name AS package_name, p.price AS package_price,
        c.active_date, c.due_day, c.isolir_day, c.status, c.notes
      FROM customers c
      JOIN packages p ON p.id = c.package_id
      ORDER BY c.created_at ASC
    `);

    const headers = [
      'Kode Pelanggan',
      'Nama Pelanggan',
      'Nomor HP / WhatsApp',
      'Alamat',
      'PPPoE Username',
      'PPPoE Password',
      'Paket Internet',
      'Harga Paket',
      'Tanggal Aktif',
      'Tgl Jatuh Tempo',
      'Tgl Isolir',
      'Status',
      'Catatan',
    ];

    const rows = customers.map((c) => [
      c.code,
      c.name,
      c.phone || '',
      c.address || '',
      c.pppoe_username,
      c.pppoe_password,
      c.package_name,
      c.package_price,
      formatDate(c.active_date),
      c.due_day,
      c.isolir_day,
      c.status,
      c.notes || '',
    ]);

    const csvContent = serializeCsv(headers, rows);
    const filename = `pelanggan_pppoe_${todayStr()}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return new Response('Unauthorized or Export Failed', { status: 401 });
  }
}
