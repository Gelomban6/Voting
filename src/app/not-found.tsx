import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="panel" style={{ textAlign: 'center', maxWidth: 420, padding: 36 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--penatua-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <FileQuestion size={28} className="teks-penatua" />
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>Halaman Tidak Ditemukan</h1>
        <p style={{ color: 'var(--redup)', fontSize: '.9rem', marginBottom: 24 }}>
          Halaman yang Anda cari tidak tersedia atau telah dipindahkan.
        </p>
        <Link href="/" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} />
          <span>Kembali ke Quick Count</span>
        </Link>
      </div>
    </div>
  );
}
