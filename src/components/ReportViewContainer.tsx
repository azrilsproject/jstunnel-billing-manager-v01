'use client';

import { useState } from 'react';
import { Icon, PageHeader } from '@/components/ui';

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
      <div className="no-print">
        <PageHeader
          title="Laporan"
          desc="Kas masuk, piutang, sebaran paket, dan rincian transaksi."
          actions={
            <>
              <div className="tab-bar" style={{ margin: 0 }}>
                <button type="button" onClick={() => setViewMode('screen')} className={`tab-link ${viewMode === 'screen' ? 'is-active' : ''}`}>
                  Ringkasan
                </button>
                <button type="button" onClick={() => setViewMode('preview')} className={`tab-link ${viewMode === 'preview' ? 'is-active' : ''}`}>
                  Lembar cetak A4
                </button>
              </div>
              <a href={exportUrl} className="btn btn-secondary" download title="Unduh transaksi (CSV / Excel)">
                <Icon name="download" size={16} /> Export CSV
              </a>
              <button type="button" onClick={() => window.print()} className="btn btn-primary" title="Cetak atau simpan PDF (A4 landscape)">
                Cetak / PDF
              </button>
            </>
          }
        />
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
