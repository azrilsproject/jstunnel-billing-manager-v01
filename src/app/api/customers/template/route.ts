import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/dal';
import { serializeCsv } from '@/lib/csv';

export async function GET(_req: NextRequest) {
  try {
    await verifySession();

    const headers = [
      'Nama Pelanggan',
      'Nomor HP / WhatsApp',
      'Alamat',
      'PPPoE Username',
      'PPPoE Password',
      'Nama Paket',
      'Tanggal Aktif (YYYY-MM-DD)',
      'Tgl Jatuh Tempo (1-31)',
      'Tgl Isolir (1-31)',
      'Catatan',
    ];

    const sampleRows = [
      [
        'Budi Santoso',
        '081234567890',
        'Jl. Mawar No. 15, RT 01/02',
        'budi_pppoe',
        'pass1234',
        'Home 20 Mbps',
        '2026-10-01',
        10,
        15,
        'Pelanggan ruko',
      ],
      [
        'Siti Aminah',
        '085678901234',
        'Jl. Melati Blok C2 No. 8',
        'siti_aminah',
        'siti2026',
        'Home 10 Mbps',
        '2026-10-05',
        5,
        10,
        'Pemasangan baru',
      ],
    ];

    const csvContent = serializeCsv(headers, sampleRows);

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="template_import_pelanggan.csv"',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return new Response('Unauthorized', { status: 401 });
  }
}
