// Helper tanggal berbasis string 'YYYY-MM-DD' (tanpa jam) agar aman dari pergeseran timezone.

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Tanggal hari ini (YYYY-MM-DD) di timezone aplikasi */
export function todayStr(timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function parseDate(s: string | Date | null | undefined): { y: number; m: number; d: number } {
  if (!s) {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  }
  if (s instanceof Date) {
    return { y: s.getFullYear(), m: s.getMonth() + 1, d: s.getDate() };
  }
  const str = String(s);
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return { y: y || 2026, m: m || 1, d: d || 1 };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Buat tanggal dengan clamp hari ke jumlah hari dalam bulan (mis. 31 -> 30 Nov) */
export function makeDate(y: number, m: number, day: number): string {
  const d = Math.min(Math.max(day, 1), daysInMonth(y, m));
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function addMonths(y: number, m: number, n: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseDate(s);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diffDays(a: string, b: string): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  return Math.round(
    (Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d)) / 86_400_000,
  );
}

export function formatDate(s: string | Date | null | undefined): string {
  if (!s) return '-';
  if (s instanceof Date) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: APP_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(s);
  }
  const str = String(s);
  const { y, m, d } = parseDate(str.slice(0, 10));
  return `${d} ${MONTHS_ID[m - 1].slice(0, 3)} ${y}`;
}

export function formatDateLong(s: string | Date | null | undefined): string {
  if (!s) return '-';
  if (s instanceof Date) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: APP_TIMEZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(s);
  }
  const str = String(s);
  const { y, m, d } = parseDate(str.slice(0, 10));
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

/** '2026-10-01' -> 'Oktober 2026' */
export function periodLabel(period: string | Date | null | undefined): string {
  if (!period) return '-';
  const { y, m } = parseDate(period);
  return `${MONTHS_ID[(m || 1) - 1]} ${y}`;
}

export function monthOptions(centerYear: number, centerMonth: number, back = 12, forward = 2) {
  const out: { value: string; label: string }[] = [];
  for (let i = forward; i >= -back; i--) {
    const { y, m } = addMonths(centerYear, centerMonth, i);
    const value = `${y}-${pad(m)}`;
    out.push({ value, label: `${MONTHS_ID[m - 1]} ${y}` });
  }
  return out;
}

/**
 * Hitung jadwal tagihan untuk bulan (y, m):
 *  - dueDate    : tanggal jatuh tempo (due_day pada bulan tsb)
 *  - isolirDate : isolir_day >= due_day -> bulan yang sama, jika lebih kecil -> bulan berikutnya
 */
export function computeSchedule(y: number, m: number, dueDay: number, isolirDay: number) {
  const period = makeDate(y, m, 1);
  const dueDate = makeDate(y, m, dueDay);
  let isolirDate: string;
  if (isolirDay >= dueDay) {
    isolirDate = makeDate(y, m, isolirDay);
  } else {
    const nx = addMonths(y, m, 1);
    isolirDate = makeDate(nx.y, nx.m, isolirDay);
  }
  return { period, dueDate, isolirDate };
}
