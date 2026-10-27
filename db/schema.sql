-- JAMES BILLING - PPPoE MikroTik Billing schema
-- Idempotent: aman dijalankan berulang kali (npm run db:migrate)

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS packages (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  price            INTEGER NOT NULL CHECK (price >= 0),
  mikrotik_profile TEXT NOT NULL,
  speed            TEXT,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS customer_code_seq;

CREATE TABLE IF NOT EXISTS customers (
  id              SERIAL PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL DEFAULT ('PLG' || lpad(nextval('customer_code_seq')::text, 4, '0')),
  name            TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  pppoe_username  TEXT UNIQUE NOT NULL,
  pppoe_password  TEXT NOT NULL,
  package_id      INTEGER NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  active_date     DATE NOT NULL,
  -- tanggal jatuh tempo tagihan tiap bulan (1-31, otomatis disesuaikan dgn jumlah hari di bulan tsb)
  due_day         SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  -- tanggal isolir tiap bulan. Jika < due_day berarti bulan berikutnya
  isolir_day      SMALLINT NOT NULL CHECK (isolir_day BETWEEN 1 AND 31),
  -- tipe pembayaran: prabayar (tagih di tgl aktif) atau pascabayar (tagih bulan depan)
  billing_type    TEXT NOT NULL DEFAULT 'prepaid' CHECK (billing_type IN ('prepaid', 'postpaid')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'isolated', 'inactive')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_status_idx ON customers (status);

CREATE TABLE IF NOT EXISTS invoices (
  id             SERIAL PRIMARY KEY,
  number         TEXT UNIQUE NOT NULL,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  period         DATE NOT NULL,              -- tanggal 1 bulan tagihan
  package_name   TEXT NOT NULL,
  amount         INTEGER NOT NULL CHECK (amount >= 0),
  issue_date     DATE NOT NULL,
  due_date       DATE NOT NULL,
  isolir_date    DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'void')),
  paid_at        TIMESTAMPTZ,
  payment_method TEXT,
  paid_by        INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, period)
);

CREATE INDEX IF NOT EXISTS invoices_status_isolir_idx ON invoices (status, isolir_date);
CREATE INDEX IF NOT EXISTS invoices_period_idx ON invoices (period);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          SERIAL PRIMARY KEY,
  level       TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'success', 'warning', 'error')),
  action      TEXT NOT NULL,
  message     TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON activity_logs (created_at DESC);

-- Migrasi kolom billing_type untuk database yang sudah berjalan
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'prepaid' CHECK (billing_type IN ('prepaid', 'postpaid'));
