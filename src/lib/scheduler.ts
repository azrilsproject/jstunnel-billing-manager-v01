import { runBillingCycle } from './billing';

const g = globalThis as unknown as { billingScheduler?: NodeJS.Timeout };

/**
 * Scheduler internal: menjalankan siklus billing (generate invoice + cek isolir)
 * setiap SCHEDULER_INTERVAL_MINUTES menit. Semua proses idempotent sehingga aman diulang.
 */
export function startScheduler() {
  const minutes = Number(process.env.SCHEDULER_INTERVAL_MINUTES ?? 10);
  if (!minutes || minutes <= 0 || g.billingScheduler) return;

  const tick = async () => {
    try {
      const r = await runBillingCycle('scheduler');
      if (!r.skipped) console.log(`[billing] ${r.summary}`);
    } catch (err) {
      console.error('[billing] siklus gagal:', err);
    }
  };

  // jalankan pertama kali 15 detik setelah server start
  setTimeout(tick, 15_000);
  g.billingScheduler = setInterval(tick, minutes * 60_000);
  console.log(`[billing] scheduler aktif, interval ${minutes} menit`);
}
