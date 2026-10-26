export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** penanda unik tiap respon agar toast tampil ulang */
  ts?: number;
};

export const initialState: ActionState = {};

export function ok(message: string): ActionState {
  return { ok: true, message, ts: Date.now() };
}

export function fail(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors, ts: Date.now() };
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

export function int(fd: FormData, key: string): number {
  return parseInt(str(fd, key), 10);
}
