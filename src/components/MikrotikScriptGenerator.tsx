'use client';

import { useState, useEffect } from 'react';

type Props = {
  defaultProfile?: string;
};

export function MikrotikScriptGenerator({ defaultProfile = 'ISOLIR' }: Props) {
  const [rosVersion, setRosVersion] = useState<'ros7' | 'ros6'>('ros7');
  const [method, setMethod] = useState<'proxy' | 'dstnat'>('proxy');
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState('3000');
  const [profileName, setProfileName] = useState(defaultProfile);
  const [subnet, setSubnet] = useState('10.100.100.0/24');
  const [gateway, setGateway] = useState('10.100.100.1');
  const [poolRange, setPoolRange] = useState('10.100.100.2-10.100.100.254');
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '202.182.57.8';
      const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
      setServerHost(host);
      setServerPort(port === '80' || port === '443' ? '' : port);
    }
  }, []);

  const fullUrl =
    serverHost
      ? `http://${serverHost}${serverPort ? `:${serverPort}` : ''}/isolir`
      : 'http://202.182.57.8:3000/isolir';

  const hostOnly = serverHost || '202.182.57.8';
  const effectivePort = serverPort || '80';

  const generateScript = () => {
    if (rosVersion === 'ros7') {
      if (method === 'proxy') {
        return `# ====================================================================
# SCRIPT REDIRECT ISOLIR MIKROTIK ROUTEROS v7 (ROS 7)
# METODE: WEB PROXY REDIRECT (HTTP 302 KE HALAMAN BILLING)
# TARGET WEB: ${fullUrl}
# ====================================================================

# 1. Buat IP Pool khusus untuk pelanggan isolir
/ip pool add name="pool-isolir" ranges=${poolRange} comment="Pool IP Pelanggan Isolir Billing"

# 2. Buat Profile PPP Isolir
/ppp profile add name="${profileName}" local-address=${gateway} remote-address=pool-isolir address-list="ISOLIR-LIST" rate-limit="128k/128k" dns-server=8.8.8.8,1.1.1.1 comment="Profile Isolir Otomatis Billing"

# 3. Aktifkan Web Proxy MikroTik untuk Redirect HTTP (RouterOS v7)
/ip proxy set enabled=yes port=8080 max-cache-size=none
/ip proxy access add action=redirect action-data="${fullUrl}" comment="Redirect Isolir ke Web Billing"

# 4. NAT: Alihkan trafik HTTP (port 80) pelanggan isolir ke Web Proxy
/ip firewall nat add chain=dstnat protocol=tcp dst-port=80 src-address-list="ISOLIR-LIST" action=redirect to-ports=8080 comment="NAT Redirect HTTP Isolir ke Web Proxy"

# 5. Firewall Filter: Pengamanan & Pembatasan Akses
# A. Izinkan lookup DNS (port 53)
/ip firewall filter add chain=forward protocol=udp dst-port=53 src-address-list="ISOLIR-LIST" action=accept comment="Izinkan DNS UDP Isolir"
/ip firewall filter add chain=forward protocol=tcp dst-port=53 src-address-list="ISOLIR-LIST" action=accept comment="Izinkan DNS TCP Isolir"

# B. Izinkan akses langsung ke Server Billing
/ip firewall filter add chain=forward dst-address=${hostOnly} src-address-list="ISOLIR-LIST" action=accept comment="Izinkan Akses ke Server Billing"

# C. Tolak HTTPS (port 443) dengan TCP Reset agar browser memicu fallback/captive portal
/ip firewall filter add chain=forward protocol=tcp dst-port=443 src-address-list="ISOLIR-LIST" action=reject reject-with=tcp-reset comment="Tolak HTTPS Isolir (TCP Reset)"

# D. Drop semua trafik internet lainnya (game, WA, browsing lain terkunci)
/ip firewall filter add chain=forward src-address-list="ISOLIR-LIST" action=drop comment="Drop Semua Traffic Isolir Lainnya"
`;
      } else {
        return `# ====================================================================
# SCRIPT REDIRECT ISOLIR MIKROTIK ROUTEROS v7 (ROS 7)
# METODE: DIRECT DST-NAT KE SERVER BILLING
# TARGET SERVER: ${hostOnly}:${effectivePort}
# ====================================================================

# 1. Buat IP Pool khusus untuk pelanggan isolir
/ip pool add name="pool-isolir" ranges=${poolRange} comment="Pool IP Pelanggan Isolir Billing"

# 2. Buat Profile PPP Isolir
/ppp profile add name="${profileName}" local-address=${gateway} remote-address=pool-isolir address-list="ISOLIR-LIST" rate-limit="128k/128k" dns-server=8.8.8.8,1.1.1.1 comment="Profile Isolir Otomatis Billing"

# 3. NAT: Belokkan HTTP port 80 langsung ke IP & Port Server Billing
/ip firewall nat add chain=dstnat protocol=tcp dst-port=80 src-address-list="ISOLIR-LIST" dst-address=!${hostOnly} action=dst-nat to-addresses=${hostOnly} to-ports=${effectivePort} comment="Direct DST-NAT HTTP ke Server Billing"

# 4. Firewall Filter: Izinkan DNS & Server Billing, Blokir yang lain
/ip firewall filter add chain=forward protocol=udp dst-port=53 src-address-list="ISOLIR-LIST" action=accept comment="Izinkan DNS UDP Isolir"
/ip firewall filter add chain=forward protocol=tcp dst-port=53 src-address-list="ISOLIR-LIST" action=accept comment="Izinkan DNS TCP Isolir"
/ip firewall filter add chain=forward dst-address=${hostOnly} src-address-list="ISOLIR-LIST" action=accept comment="Izinkan Akses ke Server Billing"
/ip firewall filter add chain=forward protocol=tcp dst-port=443 src-address-list="ISOLIR-LIST" action=reject reject-with=tcp-reset comment="Tolak HTTPS Isolir"
/ip firewall filter add chain=forward src-address-list="ISOLIR-LIST" action=drop comment="Drop Traffic Isolir Lainnya"
`;
      }
    } else {
      // RouterOS v6
      if (method === 'proxy') {
        return `# ====================================================================
# SCRIPT REDIRECT ISOLIR MIKROTIK ROUTEROS v6 (ROS 6)
# METODE: WEB PROXY REDIRECT (HTTP 302 KE HALAMAN BILLING)
# TARGET WEB: ${fullUrl}
# ====================================================================

# 1. Buat IP Pool khusus untuk pelanggan isolir
/ip pool add name="pool-isolir" ranges=${poolRange} comment="Pool IP Pelanggan Isolir Billing"

# 2. Buat Profile PPP Isolir (Kompatibel ROS 6)
/ppp profile add name="${profileName}" local-address=${gateway} remote-address=pool-isolir address-list="ISOLIR-LIST" rate-limit="128k/128k" dns-server=8.8.8.8,1.1.1.1 comment="Profile Isolir Otomatis Billing"

# 3. Aktifkan Web Proxy MikroTik untuk Redirect HTTP
/ip proxy set enabled=yes port=8080 max-cache-size=none
/ip proxy access add action=deny redirect-to="${fullUrl}" comment="Redirect Isolir ke Web Billing"

# 4. NAT: Alihkan trafik HTTP (port 80) pelanggan isolir ke Web Proxy (Dukung Subnet & Address-List)
/ip firewall nat add chain=dstnat protocol=tcp dst-port=80 src-address=${subnet} action=redirect to-ports=8080 comment="NAT Redirect HTTP Isolir ke Web Proxy"
/ip firewall nat add chain=dstnat protocol=tcp dst-port=80 src-address-list="ISOLIR-LIST" action=redirect to-ports=8080 comment="NAT Redirect Address-List Isolir"

# 5. Firewall Filter: Pengamanan & Pembatasan Akses
# A. Izinkan lookup DNS (port 53)
/ip firewall filter add chain=forward protocol=udp dst-port=53 src-address=${subnet} action=accept comment="Izinkan DNS UDP Isolir"
/ip firewall filter add chain=forward protocol=tcp dst-port=53 src-address=${subnet} action=accept comment="Izinkan DNS TCP Isolir"

# B. Izinkan akses langsung ke Server Billing
/ip firewall filter add chain=forward dst-address=${hostOnly} src-address=${subnet} action=accept comment="Izinkan Akses ke Server Billing"

# C. Tolak HTTPS (port 443) dengan TCP Reset
/ip firewall filter add chain=forward protocol=tcp dst-port=443 src-address=${subnet} action=reject reject-with=tcp-reset comment="Tolak HTTPS Isolir (TCP Reset)"

# D. Drop semua trafik internet lainnya
/ip firewall filter add chain=forward src-address=${subnet} action=drop comment="Drop Semua Traffic Isolir Lainnya"
`;
      } else {
        return `# ====================================================================
# SCRIPT REDIRECT ISOLIR MIKROTIK ROUTEROS v6 (ROS 6)
# METODE: DIRECT DST-NAT KE SERVER BILLING
# TARGET SERVER: ${hostOnly}:${effectivePort}
# ====================================================================

# 1. Buat IP Pool khusus untuk pelanggan isolir
/ip pool add name="pool-isolir" ranges=${poolRange} comment="Pool IP Pelanggan Isolir Billing"

# 2. Buat Profile PPP Isolir
/ppp profile add name="${profileName}" local-address=${gateway} remote-address=pool-isolir address-list="ISOLIR-LIST" rate-limit="128k/128k" dns-server=8.8.8.8,1.1.1.1 comment="Profile Isolir Otomatis Billing"

# 3. NAT: Belokkan HTTP port 80 langsung ke IP & Port Server Billing
/ip firewall nat add chain=dstnat protocol=tcp dst-port=80 src-address=${subnet} dst-address=!${hostOnly} action=dst-nat to-addresses=${hostOnly} to-ports=${effectivePort} comment="Direct DST-NAT HTTP ke Server Billing"

# 4. Firewall Filter: Izinkan DNS & Server Billing, Blokir yang lain
/ip firewall filter add chain=forward protocol=udp dst-port=53 src-address=${subnet} action=accept comment="Izinkan DNS UDP Isolir"
/ip firewall filter add chain=forward protocol=tcp dst-port=53 src-address=${subnet} action=accept comment="Izinkan DNS TCP Isolir"
/ip firewall filter add chain=forward dst-address=${hostOnly} src-address=${subnet} action=accept comment="Izinkan Akses ke Server Billing"
/ip firewall filter add chain=forward protocol=tcp dst-port=443 src-address=${subnet} action=reject reject-with=tcp-reset comment="Tolak HTTPS Isolir"
/ip firewall filter add chain=forward src-address=${subnet} action=drop comment="Drop Traffic Isolir Lainnya"
`;
      }
    }
  };

  const scriptCode = generateScript();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = scriptCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([scriptCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-isolir-${rosVersion}.rsc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="script-isolir"
      style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(37, 99, 235, 0.06))',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '14px',
        padding: '24px',
        marginTop: '28px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '22px' }}>🛡️</span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Generator Script Isolir MikroTik (ROS 6 & ROS 7)
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Tinggal copy-paste ke terminal MikroTik untuk redirect otomatis pelanggan isolir ke web tagihan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '12px' }}
        >
          {showConfig ? 'Sembunyikan Opsi Parameter' : 'Sesuaikan IP & Parameter'}
        </button>
      </div>

      {/* Accordion Parameter Konfigurasi */}
      {showConfig && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          <div>
            <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>
              IP / Host Server Billing
            </label>
            <input
              type="text"
              value={serverHost}
              onChange={(e) => setServerHost(e.target.value)}
              placeholder="Contoh: 202.182.57.8"
              className="form-input font-mono"
              style={{ fontSize: '13px', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>
              Port Web Server (Kosongkan jika 80)
            </label>
            <input
              type="text"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              placeholder="3000"
              className="form-input font-mono"
              style={{ fontSize: '13px', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>
              Nama Profile Isolir
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="ISOLIR"
              className="form-input font-mono"
              style={{ fontSize: '13px', padding: '6px 10px' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>
              Subnet IP Isolir
            </label>
            <input
              type="text"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="10.100.100.0/24"
              className="form-input font-mono"
              style={{ fontSize: '13px', padding: '6px 10px' }}
            />
          </div>
        </div>
      )}

      {/* Tombol Pilihan ROS6 & ROS7 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setRosVersion('ros7')}
            style={{
              padding: '8px 18px',
              borderRadius: '7px',
              border: 'none',
              background: rosVersion === 'ros7' ? '#2563eb' : 'transparent',
              color: rosVersion === 'ros7' ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>RouterOS v7 (ROS 7)</span>
            <span style={{ fontSize: '10.5px', background: rosVersion === 'ros7' ? 'rgba(255,255,255,0.2)' : 'rgba(37,99,235,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
              Modern
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRosVersion('ros6')}
            style={{
              padding: '8px 18px',
              borderRadius: '7px',
              border: 'none',
              background: rosVersion === 'ros6' ? '#2563eb' : 'transparent',
              color: rosVersion === 'ros6' ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>RouterOS v6 (ROS 6)</span>
            <span style={{ fontSize: '10.5px', background: rosVersion === 'ros6' ? 'rgba(255,255,255,0.2)' : 'rgba(100,116,139,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
              Legacy
            </span>
          </button>
        </div>

        {/* Pilihan Metode Redirect */}
        <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setMethod('proxy')}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              border: 'none',
              background: method === 'proxy' ? '#10b981' : 'transparent',
              color: method === 'proxy' ? '#fff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
            title="Menggunakan Web Proxy internal MikroTik (Sangat direkomendasikan)"
          >
            Web Proxy Redirect (Rekomendasi)
          </button>

          <button
            type="button"
            onClick={() => setMethod('dstnat')}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              border: 'none',
              background: method === 'dstnat' ? '#10b981' : 'transparent',
              color: method === 'dstnat' ? '#fff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
            title="Direct DST-NAT tanpa Web Proxy"
          >
            Direct DST-NAT
          </button>
        </div>

        {/* Tombol Copy & Download */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleDownload}
            className="btn btn-secondary btn-sm"
            title="Download script format .rsc untuk MikroTik"
          >
            Unduh .rsc
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={`btn btn-sm ${copied ? 'btn-success' : 'btn-primary'}`}
            style={{ minWidth: '150px', justifyContent: 'center' }}
          >
            {copied ? '✔ Tersalin ke Clipboard!' : '📋 Salin Script (Copy)'}
          </button>
        </div>
      </div>

      {/* Target URL Alert Bar */}
      <div
        style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '14px',
          fontSize: '12.5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          URL Redirect Tujuan Pelanggan: <strong className="font-mono" style={{ color: '#60a5fa' }}>{fullUrl}</strong>
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>
          Versi Terpilih: <strong>{rosVersion.toUpperCase()}</strong> ({method === 'proxy' ? 'Web Proxy 302' : 'Direct DST-NAT'})
        </div>
      </div>

      {/* Terminal Code Preview */}
      <div
        style={{
          background: '#090d16',
          borderRadius: '10px',
          border: '1px solid #1e293b',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Terminal Title Bar */}
        <div
          style={{
            background: '#0f172a',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
              MikroTik RouterOS Terminal — script-isolir-{rosVersion}.rsc
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: copied ? '#059669' : '#1e293b',
              color: '#fff',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '5px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {copied ? '✔ Tersalin' : '📋 Copy'}
          </button>
        </div>

        {/* Code Content */}
        <pre
          style={{
            padding: '18px 20px',
            margin: 0,
            color: '#38bdf8',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.65',
            overflowX: 'auto',
            maxHeight: '340px',
            whiteSpace: 'pre',
          }}
        >
          <code>{scriptCode}</code>
        </pre>
      </div>

      {/* Petunjuk Penggunaan */}
      <div
        style={{
          marginTop: '16px',
          padding: '14px 18px',
          background: 'var(--bg-elevated)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          fontSize: '12.5px',
          color: 'var(--text-muted)',
          lineHeight: '1.5',
        }}
      >
        <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
          Cara Menggunakan di MikroTik:
        </strong>
        <ol style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>Buka aplikasi <strong>Winbox</strong> dan login ke router MikroTik Anda.</li>
          <li>Klik menu <strong>New Terminal</strong> di sebelah kiri.</li>
          <li>Klik tombol <strong>Salin Script (Copy)</strong> di atas, lalu paste (klik kanan &gt; Paste) ke dalam terminal MikroTik.</li>
          <li>Tekan <strong>Enter</strong> untuk mengeksekusi semua konfigurasi secara otomatis.</li>
          <li>
            Selesai! Saat sistem billing mengisolir pelanggan (status terisolir), secret PPPoE pelanggan otomatis dialihkan ke profile <code>{profileName}</code> dan saat mereka membuka browser, akan langsung dialihkan ke halaman web tagihan.
          </li>
        </ol>
      </div>
    </div>
  );
}
