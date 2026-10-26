import { getSettings } from '@/lib/settings';

export default async function IsolirPublicPage() {
  const settings = await getSettings();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(ellipse at 50% 30%, #450a0a 0%, #0b0f19 80%)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '40px 36px',
          textAlign: 'center',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div
          style={{
            width: '68px',
            height: '68px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
          }}
        >
          🛡️
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fca5a5', letterSpacing: '-0.5px' }}>
          Layanan Internet Terisolir
        </h1>
        <p style={{ fontSize: '14.5px', color: '#e5e7eb', marginTop: '10px', lineHeight: 1.6 }}>
          Koneksi internet Anda saat ini dinonaktifkan sementara karena tagihan bulanan telah melewati batas tanggal isolir.
        </p>

        {/* Kotak Rekening & Pembayaran */}
        <div
          style={{
            marginTop: '28px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#93c5fd', marginBottom: '8px', letterSpacing: '0.5px' }}>
            💳 Rekening Pembayaran Resmi {settings.company_name || 'JAMES NET'}
          </div>
          <div style={{ fontSize: '13.5px', color: '#fff', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {settings.bank_info || 'Silakan hubungi admin atau customer service untuk nomor rekening pembayaran.'}
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '20px' }}>
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

        <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-dim)' }}>
          {settings.company_name || 'JAMES NET'} • Customer Care & Billing System
        </div>
      </div>
    </div>
  );
}
