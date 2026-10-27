'use client';

import { useState } from 'react';
import Link from 'next/link';
import { importCustomersCsvAction, type ImportCsvResult } from '@/app/actions/customers';

export function CustomerImportForm() {
  const [state, setState] = useState<ImportCsvResult | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [inputTab, setInputTab] = useState<'file' | 'text'>('file');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await importCustomersCsvAction(fd);
      setState(res);
    } catch (err) {
      setState({
        ok: false,
        total: 0,
        imported: 0,
        failed: 1,
        errors: [{ line: 0, message: (err as Error).message || 'Gagal memproses file CSV' }],
        importedNames: [],
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hasil Import Banner */}
      {state && (
        <div
          className="card"
          style={{
            borderLeft: state.imported > 0 ? '4px solid var(--success)' : '4px solid var(--danger)',
            background: 'var(--card-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              {state.imported > 0 ? '✅ Hasil Proses Import' : '⚠️ Import Tidak Ada Data Berhasil'}
            </h3>
            <span
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '12px',
                fontWeight: 600,
                background: state.imported > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: state.imported > 0 ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {state.imported} Berhasil / {state.failed} Gagal (Total {state.total} baris)
            </span>
          </div>

          {state.imported > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-main)' }}>
                Berhasil menambahkan <strong>{state.imported}</strong> pelanggan ke database:
              </p>
              <div
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  background: 'var(--bg-subtle, rgba(0,0,0,0.2))',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '12px',
                  lineHeight: '1.6',
                }}
              >
                {state.importedNames.map((name, idx) => (
                  <div key={idx} style={{ color: 'var(--text-main)' }}>
                    • {name}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px' }}>
                <Link href="/customers" className="btn btn-success" style={{ display: 'inline-flex', padding: '6px 14px', fontSize: '13px' }}>
                  Lihat di Daftar Pelanggan →
                </Link>
              </div>
            </div>
          )}

          {state.errors && state.errors.length > 0 && (
            <div>
              <p style={{ margin: '8px 0 6px 0', fontSize: '13px', fontWeight: 600, color: '#f87171' }}>
                Catatan / Kesalahan ({state.errors.length} baris dilewati):
              </p>
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '12px',
                  lineHeight: '1.6',
                }}
              >
                {state.errors.map((err, idx) => (
                  <div key={idx} style={{ color: '#fca5a5', marginBottom: '2px' }}>
                    {err.line > 0 ? <strong>Baris {err.line}: </strong> : null}
                    {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Import */}
      <div className="card">
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          {/* Header & Template Download */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '20px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-main)' }}>
                Metode Input Data
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                Upload berkas .csv atau salin tempel langsung baris teks dari spreadsheet / Excel.
              </p>
            </div>
            <a
              href="/api/customers/template"
              className="btn btn-secondary"
              download="template_import_pelanggan.csv"
              style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              📄 Unduh Template CSV
            </a>
          </div>

          {/* Toggle Tab File / Paste */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setInputTab('file')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: inputTab === 'file' ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                background: inputTab === 'file' ? 'var(--accent)' : 'var(--bg-subtle, rgba(255,255,255,0.05))',
                color: inputTab === 'file' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              📁 Upload File CSV
            </button>
            <button
              type="button"
              onClick={() => setInputTab('text')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: inputTab === 'text' ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                background: inputTab === 'text' ? 'var(--accent)' : 'var(--bg-subtle, rgba(255,255,255,0.05))',
                color: inputTab === 'text' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              📋 Tempel Teks CSV
            </button>
          </div>

          {/* Tab 1: Upload File */}
          {inputTab === 'file' && (
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="csv_file" style={{ color: 'var(--text-main)' }}>
                Pilih Berkas CSV (.csv)
              </label>
              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-subtle, rgba(255,255,255,0.02))',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <input
                  id="csv_file"
                  name="csv_file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setSelectedFileName(file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : '');
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>📂</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  {selectedFileName ? selectedFileName : 'Klik atau seret berkas CSV ke sini'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Format yang didukung: .csv (pemisah koma , atau titik-koma ;)
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Paste Raw Text */}
          {inputTab === 'text' && (
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="csv_text" style={{ color: 'var(--text-main)' }}>
                Salin & Tempel Isi CSV di Sini
              </label>
              <textarea
                id="csv_text"
                name="csv_text"
                rows={8}
                className="form-input"
                placeholder="Nama Pelanggan,PPPoE Username,PPPoE Password,Paket,Telepon,Alamat,Tanggal Aktif,Tanggal Jatuh Tempo,Tanggal Isolir,Catatan&#10;Budi Santoso,budi_net,rahasia123,UpTo 20 Mbps,081234567890,Jl. Mawar No. 12,2026-10-01,10,15,Pelanggan Baru"
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre',
                }}
              />
              <span className="form-hint">
                Pastikan baris pertama berisi nama kolom/header dan baris berikutnya berisi data.
              </span>
            </div>
          )}

          {/* Opsi Sinkronisasi & Paket */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '16px',
              borderRadius: '10px',
              background: 'var(--bg-subtle, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-color)',
              marginBottom: '24px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="sync_mikrotik"
                value="true"
                defaultChecked
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                <strong>Sinkronkan User Secret ke MikroTik:</strong> Buat otomatis PPP Secret pada router MikroTik aktif untuk setiap pelanggan baru yang berhasil diimpor.
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="auto_create_package"
                value="true"
                defaultChecked
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                <strong>Buat Paket Otomatis:</strong> Jika nama paket di baris CSV belum terdaftar di sistem paket billing, sistem akan membuat paket tersebut secara otomatis.
              </span>
            </label>
          </div>

          {/* Tombol Aksi */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <Link href="/customers" className="btn btn-secondary">
              Batal
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isPending ? 0.7 : 1,
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? (
                <>
                  <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span>Mengimpor Data Pelanggan...</span>
                </>
              ) : (
                '📥 Mulai Proses Import'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Panduan Format Kolom */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-main)' }}>
          📋 Format Kolom File CSV
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          File CSV dapat menggunakan pemisah koma (<code>,</code>) maupun titik-koma (<code>;</code>) seperti pada Microsoft Excel regional Indonesia.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>Nama Kolom</th>
                <th>Wajib/Opsional</th>
                <th>Default / Nilai Kosong</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Nama Pelanggan</strong></td>
                <td><span className="badge badge-danger">Wajib</span></td>
                <td>-</td>
                <td>Nama lengkap pemilik langganan</td>
              </tr>
              <tr>
                <td><strong>PPPoE Username</strong></td>
                <td><span className="badge badge-danger">Wajib</span></td>
                <td>-</td>
                <td>Username PPP Secret (harus unik di sistem)</td>
              </tr>
              <tr>
                <td><strong>PPPoE Password</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>123456</td>
                <td>Kata sandi login PPP Secret MikroTik</td>
              </tr>
              <tr>
                <td><strong>Paket</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>Paket pertama</td>
                <td>Nama paket langganan / profile MikroTik</td>
              </tr>
              <tr>
                <td><strong>Sistem Tagihan</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>Prabayar</td>
                <td>Isi &apos;Prabayar&apos; (tagih di tgl aktif) atau &apos;Pascabayar&apos; (tagih bulan depan)</td>
              </tr>
              <tr>
                <td><strong>Telepon</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>(kosong)</td>
                <td>Nomor WhatsApp / telepon pelanggan</td>
              </tr>
              <tr>
                <td><strong>Alamat</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>(kosong)</td>
                <td>Alamat pemasangan pelanggan</td>
              </tr>
              <tr>
                <td><strong>Tanggal Aktif</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>Hari ini</td>
                <td>Format YYYY-MM-DD (contoh: 2026-10-01)</td>
              </tr>
              <tr>
                <td><strong>Tanggal Jatuh Tempo</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>10</td>
                <td>Hari jatuh tempo bulanan (1–31)</td>
              </tr>
              <tr>
                <td><strong>Tanggal Isolir</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>15</td>
                <td>Hari isolir otomatis bulanan (1–31)</td>
              </tr>
              <tr>
                <td><strong>Catatan</strong></td>
                <td><span className="badge badge-secondary">Opsional</span></td>
                <td>Import CSV</td>
                <td>Keterangan atau info ODP/port pelanggan</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CustomerImportForm;
