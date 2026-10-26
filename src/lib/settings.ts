import 'server-only';
import { query } from './db';

export type Settings = {
  company_name: string;
  company_address: string;
  company_phone: string;
  bank_info: string;
  invoice_days_before: string;
  auto_isolir: string;
  mikrotik_enabled: string;
  mikrotik_host: string;
  mikrotik_port: string;
  mikrotik_tls: string;
  mikrotik_user: string;
  mikrotik_password: string;
  isolir_profile: string;
  last_cycle_at?: string;
  last_cycle_summary?: string;
};

const DEFAULTS: Settings = {
  company_name: 'JAMES NET',
  company_address: '',
  company_phone: '',
  bank_info: '',
  invoice_days_before: '7',
  auto_isolir: 'true',
  mikrotik_enabled: 'false',
  mikrotik_host: '',
  mikrotik_port: '8728',
  mikrotik_tls: 'false',
  mikrotik_user: '',
  mikrotik_password: '',
  isolir_profile: 'ISOLIR',
};

export async function getSettings(): Promise<Settings> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out as Settings;
}

export async function setSettings(values: Partial<Record<keyof Settings, string>>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
  }
}
