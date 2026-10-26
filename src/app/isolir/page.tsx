import { getSettings } from '@/lib/settings';

export default async function IsolirPublicPage() {
  const settings = await getSettings();

  return (
    <div className="isolir-page-container">
      <div className="isolir-card">
        <div className="isolir-icon-badge">
          🛡️
        </div>

        <h1 className="isolir-title">
          Layanan Internet Terisolir
        </h1>
        <p className="isolir-subtitle">
          Koneksi internet Anda saat ini dinonaktifkan sementara karena tagihan bulanan telah melewati batas tanggal isolir.
        </p>

        {/* Kotak Rekening & Pembayaran */}
        <div className="isolir-bank-box">
          <div className="isolir-bank-header">
            💳 Rekening Pembayaran Resmi {settings.company_name || 'JAMES NET'}
          </div>
          <div className="isolir-bank-content">
            {settings.bank_info || 'Silakan hubungi admin atau customer service untuk nomor rekening pembayaran.'}
          </div>
        </div>

        <p className="isolir-note">
          Setelah melakukan pembayaran, layanan internet Anda akan otomatis diaktifkan kembali oleh sistem tanpa perlu restart modem/router.
        </p>

        {settings.company_phone && (
          <div style={{ marginTop: '28px' }}>
            <a
              href={`https://wa.me/${settings.company_phone.replace(/[^0-9]/g, '')}?text=Halo%20Admin,%20saya%20ingin%20konfirmasi%20pembayaran%20tagihan%20internet%20PPPoE`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-success"
              style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            >
              💬 Konfirmasi Pembayaran via WhatsApp
            </a>
          </div>
        )}

        <div className="isolir-footer">
          {settings.company_name || 'JAMES NET'} • Customer Care & Billing System
        </div>
      </div>
    </div>
  );
}
