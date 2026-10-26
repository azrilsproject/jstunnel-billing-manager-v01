import 'server-only';
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

/**
 * Client minimal untuk MikroTik RouterOS API (port 8728 / 8729 TLS).
 * Mendukung login metode baru (>= 6.43) dan lama (challenge MD5),
 * serta reply `!empty` (RouterOS 7.18+).
 * Perintah dijalankan berurutan (tanpa tag) sehingga sederhana dan aman.
 */

export type RosOptions = {
  host: string;
  port?: number;
  user: string;
  password: string;
  tls?: boolean;
  timeoutMs?: number;
};

export type RosRow = Record<string, string>;

export class RouterOSError extends Error {
  constructor(message: string, public category?: string) {
    super(message);
    this.name = 'RouterOSError';
  }
}

type Pending = {
  replies: RosRow[];
  done: RosRow;
  trap: RosRow | null;
  resolve: (v: { replies: RosRow[]; done: RosRow }) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
};

function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) {
    const v = len | 0x8000;
    return Buffer.from([(v >> 8) & 0xff, v & 0xff]);
  }
  if (len < 0x200000) {
    const v = len | 0xc00000;
    return Buffer.from([(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  }
  if (len < 0x10000000) {
    const v = (len | 0xe0000000) >>> 0;
    return Buffer.from([(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  }
  return Buffer.from([0xf0, (len >>> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
}

/** Decode panjang word; return [length, bytesConsumed] atau null jika data belum cukup */
function decodeLength(buf: Buffer, offset: number): [number, number] | null {
  if (offset >= buf.length) return null;
  const b = buf[offset];
  if ((b & 0x80) === 0x00) return [b, 1];
  if ((b & 0xc0) === 0x80) {
    if (offset + 2 > buf.length) return null;
    return [((b & 0x3f) << 8) | buf[offset + 1], 2];
  }
  if ((b & 0xe0) === 0xc0) {
    if (offset + 3 > buf.length) return null;
    return [((b & 0x1f) << 16) | (buf[offset + 1] << 8) | buf[offset + 2], 3];
  }
  if ((b & 0xf0) === 0xe0) {
    if (offset + 4 > buf.length) return null;
    return [
      ((b & 0x0f) * 0x1000000) + (buf[offset + 1] << 16) + (buf[offset + 2] << 8) + buf[offset + 3],
      4,
    ];
  }
  if (offset + 5 > buf.length) return null;
  return [buf.readUInt32BE(offset + 1), 5];
}

export class RouterOSClient {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private sentence: string[] = [];
  private pending: Pending | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(private opts: RosOptions) {}

  async connect(): Promise<void> {
    const { host, tls: useTls = false, timeoutMs = 10_000 } = this.opts;
    const port = this.opts.port || (useTls ? 8729 : 8728);

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        cleanup();
        reject(new RouterOSError(`Gagal konek ke ${host}:${port} - ${err.message}`));
      };
      const timer = setTimeout(() => {
        cleanup();
        sock.destroy();
        reject(new RouterOSError(`Timeout konek ke ${host}:${port}`));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        sock.removeListener('error', onError);
      };

      const sock: net.Socket = useTls
        ? tls.connect({ host, port, rejectUnauthorized: false }, () => {
            cleanup();
            resolve();
          })
        : net.connect({ host, port }, () => {
            cleanup();
            resolve();
          });
      sock.once('error', onError);
      this.socket = sock;
    });

    const sock = this.socket!;
    sock.setNoDelay(true);
    sock.on('data', (chunk: Buffer) => this.onData(chunk));
    sock.on('error', (err) => this.failPending(new RouterOSError(err.message)));
    sock.on('close', () => {
      this.closed = true;
      this.failPending(new RouterOSError('Koneksi ke router terputus'));
    });

    await this.login();
  }

  private async login() {
    const { user, password } = this.opts;
    const res = await this.exec('/login', [`=name=${user}`, `=password=${password}`]);
    // RouterOS < 6.43: balas challenge
    if (res.done.ret) {
      const challenge = Buffer.from(res.done.ret, 'hex');
      const md5 = crypto.createHash('md5');
      md5.update(Buffer.from([0]));
      md5.update(Buffer.from(password, 'utf8'));
      md5.update(challenge);
      await this.exec('/login', [`=name=${user}`, `=response=00${md5.digest('hex')}`]);
    }
  }

  /** Jalankan perintah, kembalikan baris !re */
  async write(command: string, params: string[] = []): Promise<RosRow[]> {
    const res = await this.exec(command, params);
    return res.replies;
  }

  private exec(command: string, params: string[]): Promise<{ replies: RosRow[]; done: RosRow }> {
    const run = () =>
      new Promise<{ replies: RosRow[]; done: RosRow }>((resolve, reject) => {
        if (!this.socket || this.closed) {
          reject(new RouterOSError('Belum terkoneksi ke router'));
          return;
        }
        const timer = setTimeout(() => {
          this.failPending(new RouterOSError(`Timeout perintah ${command}`));
        }, this.opts.timeoutMs ?? 15_000);
        this.pending = { replies: [], done: {}, trap: null, resolve, reject, timer };

        const parts: Buffer[] = [];
        for (const word of [command, ...params]) {
          const w = Buffer.from(word, 'utf8');
          parts.push(encodeLength(w.length), w);
        }
        parts.push(Buffer.from([0]));
        this.socket.write(Buffer.concat(parts));
      });
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  private onData(chunk: Buffer) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    let offset = 0;
    while (true) {
      const dec = decodeLength(this.buffer, offset);
      if (!dec) break;
      const [len, n] = dec;
      if (offset + n + len > this.buffer.length) break;
      const word = this.buffer.subarray(offset + n, offset + n + len).toString('utf8');
      offset += n + len;
      if (len === 0) {
        const s = this.sentence;
        this.sentence = [];
        this.handleSentence(s);
      } else {
        this.sentence.push(word);
      }
    }
    this.buffer = this.buffer.subarray(offset);
  }

  private handleSentence(words: string[]) {
    if (!words.length) return;
    const type = words[0];
    const attrs: RosRow = {};
    for (const w of words.slice(1)) {
      if (w.startsWith('=')) {
        const idx = w.indexOf('=', 1);
        if (idx > 0) attrs[w.slice(1, idx)] = w.slice(idx + 1);
        else attrs[w.slice(1)] = '';
      }
    }
    const p = this.pending;

    switch (type) {
      case '!re':
        p?.replies.push(attrs);
        break;
      case '!trap':
        if (p) p.trap = attrs;
        break;
      case '!empty':
        break;
      case '!fatal': {
        const msg = words[1] || 'fatal';
        this.failPending(new RouterOSError(`Router fatal: ${msg}`));
        this.close();
        break;
      }
      case '!done':
        if (!p) break;
        clearTimeout(p.timer);
        this.pending = null;
        if (p.trap) {
          p.reject(new RouterOSError(p.trap.message || 'Perintah ditolak router', p.trap.category));
        } else {
          p.done = attrs;
          p.resolve({ replies: p.replies, done: attrs });
        }
        break;
    }
  }

  private failPending(err: Error) {
    const p = this.pending;
    if (!p) return;
    clearTimeout(p.timer);
    this.pending = null;
    p.reject(err);
  }

  close() {
    if (this.socket && !this.closed) {
      this.closed = true;
      this.socket.destroy();
    }
  }
}
