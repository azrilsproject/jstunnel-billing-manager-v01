'use client';

export function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn btn-secondary"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
      title="Cetak Laporan ke Printer atau Simpan sebagai PDF"
    >
      <span>🖨️</span>
      <span>Cetak / PDF</span>
    </button>
  );
}
