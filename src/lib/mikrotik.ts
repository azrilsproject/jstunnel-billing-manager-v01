import 'server-only';
import { RouterOSClient, RosRow } from './routeros';
import type { Router } from './routers';

export class MikrotikDisabledError extends Error {
  constructor(name?: string) {
    super(
      name
        ? `Router "${name}" sedang dinonaktifkan (Pengaturan → Router MikroTik)`
        : 'Pelanggan belum dipasangkan ke router MikroTik',
    );
    this.name = 'MikrotikDisabledError';
  }
}

export type RouterConn = Pick<Router, 'name' | 'host' | 'port' | 'tls' | 'username' | 'password' | 'enabled'>;

/** Buka koneksi ke router tertentu, jalankan fn, lalu tutup koneksi */
export async function withRouter<T>(router: RouterConn | null, fn: (api: RouterOSClient) => Promise<T>): Promise<T> {
  if (!router) throw new MikrotikDisabledError();
  if (!router.enabled || !router.host) throw new MikrotikDisabledError(router.name);
  const api = new RouterOSClient({
    host: router.host,
    port: Number(router.port) || undefined,
    user: router.username,
    password: router.password,
    tls: router.tls,
  });
  await api.connect();
  try {
    return await fn(api);
  } finally {
    api.close();
  }
}

export async function testConnection(router: RouterConn) {
  return withRouter({ ...router, enabled: true }, async (api) => {
    const [identity] = await api.write('/system/identity/print');
    const [resource] = await api.write('/system/resource/print');
    const profiles = await api.write('/ppp/profile/print');
    const secrets = await api.write('/ppp/secret/print', ['=.proplist=name']);
    const active = await api.write('/ppp/active/print', ['=.proplist=name']);
    return {
      identity: identity?.name ?? '-',
      version: resource?.version ?? '-',
      board: resource?.['board-name'] ?? '-',
      uptime: resource?.uptime ?? '-',
      profiles: profiles.map((p) => p.name),
      secretCount: secrets.length,
      activeCount: active.length,
    };
  });
}

export async function listProfiles(router: RouterConn | null): Promise<string[]> {
  return withRouter(router, async (api) => {
    const rows = await api.write('/ppp/profile/print');
    return rows.map((r) => r.name);
  });
}

export async function listSecrets(router: RouterConn | null): Promise<RosRow[]> {
  return withRouter(router, (api) => api.write('/ppp/secret/print'));
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
export async function upsertSecret(router: RouterConn | null, input: SecretInput): Promise<'created' | 'updated'> {
  return withRouter(router, async (api) => {
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
export async function setSecretProfile(router: RouterConn | null, username: string, profile: string) {
  return withRouter(router, async (api) => {
    const secret = await findSecret(api, username);
    if (!secret) throw new Error(`PPPoE secret "${username}" tidak ditemukan di router`);
    await api.write('/ppp/secret/set', [`=.id=${secret['.id']}`, `=profile=${profile}`, '=disabled=no']);
    const kicked = await kickActive(api, username);
    return { kicked };
  });
}

export async function setSecretDisabled(router: RouterConn | null, username: string, disabled: boolean) {
  return withRouter(router, async (api) => {
    const secret = await findSecret(api, username);
    if (!secret) return false;
    await api.write('/ppp/secret/set', [`=.id=${secret['.id']}`, `=disabled=${disabled ? 'yes' : 'no'}`]);
    if (disabled) await kickActive(api, username);
    return true;
  });
}

export async function removeSecret(router: RouterConn | null, username: string) {
  return withRouter(router, async (api) => {
    const secret = await findSecret(api, username);
    if (!secret) return false;
    await kickActive(api, username);
    await api.write('/ppp/secret/remove', [`=.id=${secret['.id']}`]);
    return true;
  });
}

export async function getActiveSession(router: RouterConn | null, username: string) {
  return withRouter(router, async (api) => {
    const [a] = await api.write('/ppp/active/print', [`?name=${username}`]);
    return a ? { address: a.address, uptime: a.uptime, callerId: a['caller-id'] } : null;
  });
}
