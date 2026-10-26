# JAMES BILLING - PPPoE MikroTik Billing & Isolir Management

Aplikasi web manajemen billing internet ISP / RT-RW Net untuk layanan **PPPoE MikroTik**, dilengkapi dengan penagihan invoice otomatis bulanan, pengaturan tanggal aktif & tanggal isolir per pelanggan, serta integrasi RouterOS API untuk isolir otomatis realtime.

---

## 🚀 Fitur Utama

1. **Manajemen Pelanggan PPPoE**:
   - Pencatatan Nama, No. HP/WhatsApp, Alamat, dan Kredensial (Username & Password PPPoE).
   - Pengaturan **Tanggal Pemasangan / Tanggal Aktif**.
   - Pengaturan **Tanggal Jatuh Tempo** bulanan (1–31) dan **Tanggal Isolir** bulanan (1–31) yang fleksibel per pelanggan.
   - Status pelanggan: `Aktif` (Normal), `Terisolir` (Profil dialihkan ke ISOLIR), dan `Berhenti`.

2. **Invoice & Penagihan Bulanan**:
   - Nomor invoice otomatis (`INV-YYYYMM-PLGxxxx`).
   - Otomatis dibuat setiap bulan (H-x hari sebelum jatuh tempo).
   - Halaman cetak invoice resmi siap print atau simpan sebagai PDF.
   - Pencatatan pembayaran (Cash, Transfer BCA/Mandiri/BRI, QRIS) dengan 1 klik.
   - Buka isolir otomatis seketika setelah tagihan lunas!

3. **Integrasi RouterOS MikroTik API (Port 8728 / 8729 TLS)**:
   - Dukungan penuh untuk MikroTik RouterOS v6 dan v7 (termasuk v7.18+).
   - **Otomatis Isolir**: Saat melewati tanggal isolir, sistem otomatis mengubah profile secret pelanggan ke profil `ISOLIR` dan memutuskan sesi aktif (*kick session*) sehingga perubahan langsung berlaku.
   - **Otomatis Buka Isolir**: Begitu admin menekan tombol "Bayar Lunas", profil pelanggan di MikroTik langsung dikembalikan ke profil paket internet aslinya.
   - Pemantauan Sesi Aktif PPPoE Realtime (IP Address yang didapat, Uptime, MAC Address/Caller ID).
   - Fitur **Tarik/Impor Massal Akun PPPoE** yang sudah ada di router ke database billing.

4. **Otomatisasi & Scheduler**:
   - Scheduler internal yang otomatis berjalan setiap 10 menit (tanpa perlu repot setting cron OS).
   - Endpoint `/api/cron?key=CRON_SECRET` untuk pemanggilan cron eksternal.

5. **Halaman Khusus Isolir Pelanggan (`/isolir`)**:
   - Halaman peringatan publik yang profesional bagi pelanggan yang terisolir, berisi nomor rekening dan tombol konfirmasi WhatsApp ke customer care.

---

## 🛠️ Stack Teknologi

- **Framework**: Next.js 16 (App Router & Server Actions)
- **Database**: PostgreSQL 16
- **Router Protocol**: Custom Binary MikroTik RouterOS API Client (Net/TLS Socket)
- **Styling**: Vanilla Modern CSS (Dark Theme, Glassmorphism, Print Stylesheet)
- **Keamanan**: JWT Session Cookie (`httpOnly`, `sameSite: lax`) & Bcrypt

---

## 🔑 Akun Login Administrator

Akses web browser di: **`http://localhost:3000`**

- **Username**: `admin`
- **Password**: `admin123`
*(Password dapat diganti kapan saja di menu Pengaturan)*

---

## 🚀 Instalasi Cepat di Server VPS (One-Click Installer)

Cukup clone repository ini di server Linux (Ubuntu/Debian) lalu jalankan script installer otomatis:

```bash
git clone git@github.com:azrilsproject/jamesnet-billing.git
cd jamesnet-billing
chmod +x install.sh
./install.sh
```

Script `install.sh` akan otomatis:
1. Memeriksa & menginstall Node.js 20 LTS, npm, dan PostgreSQL.
2. Membuat database `james_billing` dan merestore data/skema (`db/dump.sql` & `db/schema.sql`).
3. Mengonfigurasi file `.env` dengan token enkripsi unik yang aman.
4. Menginstall seluruh dependensi dan mem-build Next.js untuk mode produksi.
5. Menjalankan aplikasi di background via **PM2** agar tetap hidup dan otomatis start saat server restart.

---

## 🏃 Cara Menjalankan Manual di Lokal (Development)

Pastikan PostgreSQL sudah berjalan di komputer lokal:
```bash
# 1. Install dependensi
npm install

# 2. Setup database & migrasi data
npm run db:setup

# 3. Jalankan server Next.js lokal
npm run dev
```
Buka browser di **`http://localhost:3000`**.

---

## ⚙️ Menghubungkan ke Router MikroTik

1. Buka menu **Pengaturan & Router** (`/settings`).
2. Centang **"Aktifkan Integrasi MikroTik API"**.
3. Masukkan:
   - **Host / IP Router**: misal `192.168.88.1` atau IP publik/VPN.
   - **Port**: `8728` (atau `8729` jika mengaktifkan TLS).
   - **User & Password API**: User RouterOS yang memiliki hak akses grup `write` atau `full`.
   - **Profile Isolir**: `ISOLIR` (pastikan profil dengan nama ini sudah dibuat di `/ppp/profile` MikroTik).
4. Klik tombol **"🔌 Uji Koneksi ke Router Sekarang"** untuk memastikan koneksi berhasil.
5. Klik **"Simpan Konfigurasi Router"**.

---

## 📁 Struktur Direktori

```text
JAMES-BILLING/
├── db/
│   └── schema.sql             # Skema PostgreSQL (pelanggan, paket, invoice, log, settings)
├── scripts/
│   ├── migrate.mjs            # Runner migrasi SQL
│   ├── seed.mjs               # Seed admin default, settings & sample paket
│   └── seed_demo.mjs          # Seed contoh pelanggan & tagihan
├── src/
│   ├── app/
│   │   ├── actions/           # Server Actions (auth, customers, packages, invoices, settings)
│   │   ├── api/cron/          # Endpoint webhook cron
│   │   ├── customers/         # Halaman Pelanggan (List, Tambah, Edit, Detail)
│   │   ├── dashboard/         # Halaman Dashboard Operasional
│   │   ├── invoices/          # Halaman Invoice & Cetak Invoice Resmi
│   │   ├── isolir/            # Landing page publik pelanggan terisolir
│   │   ├── login/             # Halaman Login Admin
│   │   ├── logs/              # Log Aktivitas & Audit Trail
│   │   ├── packages/          # Halaman Paket Internet
│   │   ├── settings/          # Halaman Pengaturan & Integrasi RouterOS
│   │   ├── globals.css        # Tema CSS modern & cetak print
│   │   └── layout.tsx         # Root Layout
│   ├── components/            # Sidebar, SubmitButton, AppShell
│   ├── lib/
│   │   ├── billing.ts         # Inti logika tagihan, isolir & buka isolir
│   │   ├── routeros.ts        # Client protokol biner MikroTik API
│   │   ├── mikrotik.ts        # Service manajemen PPPoE secret & profile
│   │   ├── dates.ts           # Logika tanggal aktif, jatuh tempo & isolir
│   │   ├── db.ts              # Pool koneksi PostgreSQL
│   │   └── session.ts         # Session JWT
│   ├── instrumentation.ts     # Bootstrap internal scheduler
│   └── proxy.ts               # Proteksi route (Next 16 Proxy)
```
