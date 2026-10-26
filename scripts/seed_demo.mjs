import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const { rows: pkgs } = await client.query('SELECT id, name, price, mikrotik_profile FROM packages ORDER BY id');
  if (pkgs.length === 0) {
    console.log('Jalankan db:setup terlebih dahulu');
    process.exit(1);
  }

  const sampleCustomers = [
    {
      name: 'Budi Santoso',
      phone: '081234567890',
      address: 'Jl. Melati Blok A No. 12, RT 01/RW 04',
      pppoe_username: 'budi_melati',
      pppoe_password: 'secret_budi123',
      package_id: pkgs[0].id,
      active_date: '2026-08-10',
      due_day: 10,
      isolir_day: 15,
      status: 'active',
      notes: 'ODP-MLT-01 Port 3',
    },
    {
      name: 'Siti Aminah',
      phone: '081398765432',
      address: 'Perum Grand Surya Blok C5',
      pppoe_username: 'siti_aminah',
      pppoe_password: 'siti_pass456',
      package_id: pkgs[1]?.id || pkgs[0].id,
      active_date: '2026-09-05',
      due_day: 5,
      isolir_day: 10,
      status: 'isolated',
      notes: 'Tunggakan bulan ini - akun terisolir otomatis',
    },
    {
      name: 'Ahmad Fauzi (Warkop Net)',
      phone: '085711223344',
      address: 'Jl. Raya Karanganyar No. 88',
      pppoe_username: 'ahmad_fauzi_pppoe',
      pppoe_password: 'warkop_speed',
      package_id: pkgs[2]?.id || pkgs[0].id,
      active_date: '2026-07-01',
      due_day: 20,
      isolir_day: 25,
      status: 'active',
      notes: 'Pelanggan prioritas usaha',
    },
  ];

  for (const c of sampleCustomers) {
    const res = await client.query(
      `INSERT INTO customers (name, phone, address, pppoe_username, pppoe_password, package_id, active_date, due_day, isolir_day, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (pppoe_username) DO NOTHING
       RETURNING id, name, code`,
      [c.name, c.phone, c.address, c.pppoe_username, c.pppoe_password, c.package_id, c.active_date, c.due_day, c.isolir_day, c.status, c.notes],
    );
    if (res.rows.length) {
      console.log(`+ Pelanggan dibuat: ${res.rows[0].code} - ${res.rows[0].name}`);
    }
  }

  // Buat sample invoice untuk bulan Oktober 2026
  const { rows: custs } = await client.query(`
    SELECT c.id, c.code, c.due_day, c.isolir_day, p.name AS pkg_name, p.price
    FROM customers c
    JOIN packages p ON p.id = c.package_id
  `);

  for (const c of custs) {
    const invNumber = `INV-202610-${c.code}`;
    const dueDate = `2026-10-${String(c.due_day).padStart(2, '0')}`;
    const isolirDate = `2026-10-${String(c.isolir_day).padStart(2, '0')}`;
    await client.query(`
      INSERT INTO invoices (number, customer_id, period, package_name, amount, issue_date, due_date, isolir_date, status)
      VALUES ($1, $2, '2026-10-01', $3, $4, '2026-10-01', $5, $6, 'unpaid')
      ON CONFLICT (customer_id, period) DO NOTHING
    `, [invNumber, c.id, c.pkg_name, c.price, dueDate, isolirDate]);
  }

  // Set salah satu invoice menjadi lunas
  await client.query(`
    UPDATE invoices 
    SET status = 'paid', paid_at = now(), payment_method = 'Transfer BCA', notes = 'Bukti transfer valid'
    WHERE number LIKE '%PLG0001%'
  `);

  console.log('✔ 3 Contoh Pelanggan & Invoice Berhasil Dibuat!');
} catch (err) {
  console.error('Error seeding demo:', err);
} finally {
  await client.end();
}
