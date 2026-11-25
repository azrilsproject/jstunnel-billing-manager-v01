// Jalankan: npm run db:seed
// Membuat admin default, pengaturan default, dan contoh paket (jika belum ada).
import pg from 'pg';
import bcrypt from 'bcryptjs';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const ADMIN_USER = process.env.SEED_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.SEED_ADMIN_PASSWORD || 'admin123';

const defaultSettings = {
  company_name: 'JAMES NET',
  company_address: 'Jl. Contoh No. 1, Kota Anda',
  company_phone: '0812-0000-0000',
  bank_info: 'BCA 1234567890 a.n. James Net',
  invoice_days_before: '7',
  auto_isolir: 'true',
  timezone: 'Asia/Jakarta',
};

try {
  await client.query('BEGIN');

  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  const admin = await client.query(
    `INSERT INTO admins (username, password_hash, name) VALUES ($1, $2, 'Administrator')
     ON CONFLICT (username) DO NOTHING RETURNING id`,
    [ADMIN_USER, hash],
  );

  for (const [key, value] of Object.entries(defaultSettings)) {
    await client.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value],
    );
  }

  const { rows } = await client.query('SELECT count(*)::int AS n FROM packages');
  if (rows[0].n === 0) {
    await client.query(
      `INSERT INTO packages (name, price, mikrotik_profile, speed, description) VALUES
       ('Home 10 Mbps', 150000, 'HOME-10M', '10 Mbps', 'Paket rumahan basic'),
       ('Home 20 Mbps', 200000, 'HOME-20M', '20 Mbps', 'Paket rumahan standar'),
       ('Home 50 Mbps', 300000, 'HOME-50M', '50 Mbps', 'Paket rumahan premium')`,
    );
  }

  await client.query('COMMIT');
  console.log('✔ Seed selesai');
  if (admin.rowCount) console.log(`  Login admin: ${ADMIN_USER} / ${ADMIN_PASS}  (segera ganti password!)`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('✖ Seed gagal:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
