'use client';

import { useState } from 'react';

type Props = {
  screenContent: React.ReactNode;
  printContent: React.ReactNode;
  exportUrl: string;
};

export function ReportViewContainer({ screenContent, printContent, exportUrl }: Props) {
  const [viewMode, setViewMode] = useState<'screen' | 'preview'>('screen');

  return (
    <div>
      {/* 1. Page Header & Actions Bar (Hidden on Print) */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">📈 Laporan Keuangan & Penagihan</h1>
          <p className="page-desc">
            Rekapitulasi pendapatan kas masuk, piutang tertunggak, sebaran paket, dan rincian transaksi.
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Mode Switcher: Dashboard vs Pratinjau Cetak */}
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--bg-elevated)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('screen')}
              className="btn btn-sm"
              style={{
                background: viewMode === 'screen' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'screen' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600,
                padding: '6px 14px',
                border: 'none',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              📊 Dasbor Interaktif
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className="btn btn-sm"
              style={{
                background: viewMode === 'preview' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'preview' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600,
                padding: '6px 14px',
                border: 'none',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              📄 Pratinjau Lembar Cetak A4
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              padding: '8px 16px',
              boxShadow: '0 2px 10px rgba(59, 130, 246, 0.4)',
            }}
            title="Cetak Laporan ke Printer atau Simpan sebagai PDF (A4 Landscape)"
          >
            <span>🖨️</span>
            <span>Cetak / Simpan PDF</span>
          </button>

          {/* Export CSV Button */}
          <a
            href={exportUrl}
            className="btn btn-secondary"
            download
            title="Download laporan transaksi dalam format file CSV / Excel"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '8px 14px' }}
          >
            <span>📥</span>
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* 2. Interactive Screen View (Active in 'screen' mode, completely hidden on print) */}
      <div className={`report-screen-view ${viewMode === 'preview' ? 'screen-hidden' : ''}`}>
        {screenContent}
      </div>

      {/* 3. Formal Printable Document Sheet */}
      {/* Visible on screen when 'preview' mode is active; ALWAYS printed in @media print */}
      <div className={`report-print-sheet-wrapper ${viewMode === 'screen' ? 'screen-hidden' : ''}`}>
        {viewMode === 'preview' && (
          <div
            className="no-print"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '13px', color: '#93c5fd' }}>
              ℹ️ <strong>Mode Pratinjau Lembar Cetak:</strong> Format di bawah adalah tampilan resmi dokumen cetak A4 (Landscape). Klik tombol <strong>Cetak / Simpan PDF</strong> untuk mengekspor ke file PDF.
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700 }}
            >
              🖨️ Cetak Sekarang
            </button>
          </div>
        )}

        {printContent}
      </div>
    </div>
  );
}
