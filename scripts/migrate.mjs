// Jalankan: npm run db:migrate
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(dir, '..', 'db', 'schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log('✔ Migrasi database selesai');
} catch (err) {
  console.error('✖ Migrasi gagal:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
