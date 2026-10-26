import 'server-only';
import { RouterOSClient, RosRow } from './routeros';
import { getSettings, Settings } from './settings';

export class MikrotikDisabledError extends Error {
  constructor() {
    super('Integrasi MikroTik belum diaktifkan (Pengaturan → MikroTik)');
    this.name = 'MikrotikDisabledError';
  }
}

export function isMikrotikEnabled(s: Settings) {
  return s.mikrotik_enabled === 'true' && !!s.mikrotik_host;
}

/** Buka koneksi, jalankan fn, lalu tutup koneksi */
export async function withRouter<T>(
  fn: (api: RouterOSClient, s: Settings) => Promise<T>,
  settings?: Settings,
): Promise<T> {
  const s = settings ?? (await getSettings());
  if (!isMikrotikEnabled(s)) throw new MikrotikDisabledError();
  const api = new RouterOSClient({
    host: s.mikrotik_host,
    port: Number(s.mikrotik_port) || undefined,
    user: s.mikrotik_user,
    password: s.mikrotik_password,
    tls: s.mikrotik_tls === 'true',
  });
  await api.connect();
  try {
    return await fn(api, s);
  } finally {
    api.close();
  }
}

export async function testConnection(override?: Partial<Settings>) {
  const base = await getSettings();
  const s = { ...base, ...override, mikrotik_enabled: 'true' } as Settings;
  return withRouter(async (api) => {
    const [identity] = await api.write('/system/identity/print');
    const [resource] = await api.write('/system/resource/print');
    const profiles = await api.write('/ppp/profile/print');
    const secrets = await api.write('/ppp/secret/print', ['=.proplist=name']);
    return {
      identity: identity?.name ?? '-',
      version: resource?.version ?? '-',
      board: resource?.['board-name'] ?? '-',
      uptime: resource?.uptime ?? '-',
      profiles: profiles.map((p) => p.name),
      secretCount: secrets.length,
    };
  }, s);
}

export async function listProfiles(): Promise<string[]> {
  return withRouter(async (api) => {
    const rows = await api.write('/ppp/profile/print');
    return rows.map((r) => r.name);
  });
}

export async function listSecrets(): Promise<RosRow[]> {
  return withRouter((api) => api.write('/ppp/secret/print'));
}

async function findSecret(api: RouterOSClient, username: string) {
  const rows = await api.write('/ppp/secret/print', [`?name=${username}`]);
  return rows[0] ?? null;
}

async function kickActive(api: RouterOSClient, username: string) {
  const active = await api.write('/ppp/active/print', [`?name=${username}`]);
  for (const a of active) {
    await api.write('/ppp/active/remove', [`=.id=${a['.id']}`]);
  }
  return active.length;
}

export type SecretInput = {
  username: string;
  password: string;
  profile: string;
  comment?: string;
  disabled?: boolean;
  /** username lama jika username diganti */
  previousUsername?: string;
};

/** Buat / update PPPoE secret. Return 'created' | 'updated' */
export async function upsertSecret(input: SecretInput): Promise<'created' | 'updated'> {
  return withRouter(async (api) => {
    let existing = await findSecret(api, input.username);
    if (!existing && input.previousUsername && input.previousUsername !== input.username) {
      existing = await findSecret(api, input.previousUsername);
    }
    const fields = [
      `=name=${input.username}`,
      `=password=${input.password}`,
      `=profile=${input.profile}`,
      `=comment=${input.comment ?? ''}`,
      `=disabled=${input.disabled ? 'yes' : 'no'}`,
    ];
    if (existing) {
      const profileChanged = existing.profile !== input.profile;
      await api.write('/ppp/secret/set', [`=.id=${existing['.id']}`, ...fields]);
      if (profileChanged || input.disabled) await kickActive(api, existing.name);
      return 'updated';
    }
    await api.write('/ppp/secret/add', [...fields, '=service=pppoe']);
    return 'created';
  });
}

/** Ganti profile secret lalu putuskan sesi aktif supaya profile baru langsung berlaku */
export async function setSecretProfile(username: string, profile: string) {
  return withRouter(async (api) => {
    const secret = await findSecret(api, username);
    if (!secret) throw new Error(`PPPoE secret "${username}" tidak ditemukan di router`);
    await api.write('/ppp/secret/set', [`=.id=${secret['.id']}`, `=profile=${profile}`, '=disabled=no']);
    const kicked = await kickActive(api, username);
    return { kicked };
  });
}

export async function setSecretDisabled(username: string, disabled: boolean) {
  return withRouter(async (api) => {
    const secret = await findSecret(api, username);
    if (!secret) return false;
    await api.write('/ppp/secret/set', [`=.id=${secret['.id']}`, `=disabled=${disabled ? 'yes' : 'no'}`]);
    if (disabled) await kickActive(api, username);
    return true;
  });
}

export async function removeSecret(username: string) {
  return withRouter(async (api) => {
    const secret = await findSecret(api, username);
    if (!secret) return false;
    await kickActive(api, username);
    await api.write('/ppp/secret/remove', [`=.id=${secret['.id']}`]);
    return true;
  });
}

export async function getActiveSession(username: string) {
  return withRouter(async (api) => {
    const [a] = await api.write('/ppp/active/print', [`?name=${username}`]);
    return a ? { address: a.address, uptime: a.uptime, callerId: a['caller-id'] } : null;
  });
}
