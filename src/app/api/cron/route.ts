import { NextResponse, type NextRequest } from 'next/server';
import { runBillingCycle } from '@/lib/billing';

/**
 * Endpoint untuk cron eksternal (opsional), contoh crontab:
 *   *\/10 * * * * curl -s "https://billing.domain.com/api/cron?key=CRON_SECRET"
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? request.headers.get('x-cron-key');
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await runBillingCycle('api/cron');
  return NextResponse.json(result);
}
