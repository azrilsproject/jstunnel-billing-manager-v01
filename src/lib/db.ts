import 'server-only';
import pg from 'pg';

// DATE (1082) -> string 'YYYY-MM-DD' agar tidak bergeser zona waktu
pg.types.setTypeParser(1082, (v: string) => v);
// BIGINT (20) -> number (hasil SUM/COUNT)
pg.types.setTypeParser(20, (v: string) => parseInt(v, 10));

const globalForPg = globalThis as unknown as { pgPool?: pg.Pool };

export const pool =
  globalForPg.pgPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
