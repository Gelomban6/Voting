'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Vote,
  Users,
  Shield,
  LogIn,
  ArrowLeft,
  KeyRound,
  Lock,
} from 'lucide-react';

interface PilihanKolom { id: number; nama: string }

export default function FormLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<'petugas' | 'admin'>('petugas');
  const [daftarKolom, setDaftarKolom] = useState<PilihanKolom[]>([]);
  const [kolomId, setKolomId] = useState(1);

  // Daftar kolom mengikuti pengaturan admin (jumlah & nama)
  useEffect(() => {
    fetch('/api/quickcount', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json.kolom?.length) {
          setDaftarKolom(json.kolom.map((k: PilihanKolom) => ({ id: k.id, nama: k.nama })));
          setKolomId(json.kolom[0].id);
        }
      })
      .catch(() => {});
  }, []);
  const [kode, setKode] = useState('');
  const [password, setPassword] = useState('');
  const [gagal, setGagal] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    setProses(true);
    setGagal(null);
    try {
      const body =
        mode === 'admin'
          ? { mode: 'admin', password }
          : { mode: 'petugas', kolomId, kode };
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setGagal(json.error ?? 'Gagal masuk');
      } else {
        router.push(json.role === 'admin' ? '/admin' : '/petugas');
      }
    } catch {
      setGagal('Tidak dapat terhubung ke server');
    } finally {
      setProses(false);
    }
  }

  const gayaTab = (aktif: boolean, jenis: 'petugas' | 'admin'): React.CSSProperties => ({
    flex: 1, padding: '10px 0', minHeight: 44, borderRadius: 10, cursor: 'pointer',
    fontWeight: 600, fontSize: '.9rem',
    background: aktif ? (jenis === 'petugas' ? 'var(--penatua-tua)' : 'var(--panel-2)') : 'transparent',
    color: aktif ? '#fff' : 'var(--redup)',
    border: aktif && jenis === 'admin' ? '1px solid var(--border)' : '1px solid transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'all .2s ease',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="panel" style={{ width: '100%', maxWidth: 400, padding: 32 }} onSubmit={masuk}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--penatua-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: 'var(--penatua)' }}>
            <Vote size={26} />
          </div>
          <h1 style={{ fontSize: '1.25rem', textAlign: 'center', fontWeight: 700 }}>
            {mode === 'admin' ? 'Login Panitia Admin' : 'Login Petugas Kolom'}
          </h1>
          <p style={{ textAlign: 'center', color: 'var(--redup)', fontSize: '.85rem', marginTop: 4 }}>
            Pemilihan Penatua &amp; Diaken
          </p>
        </div>

        <div role="tablist" style={{ display: 'flex', gap: 6, background: 'var(--bg)', borderRadius: 12, padding: 5, marginBottom: 20 }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'petugas'}
            style={gayaTab(mode === 'petugas', 'petugas')}
            onClick={() => setMode('petugas')}
          >
            <Users size={15} />
            <span>Petugas Kolom</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'admin'}
            style={gayaTab(mode === 'admin', 'admin')}
            onClick={() => setMode('admin')}
          >
            <Shield size={15} />
            <span>Admin</span>
          </button>
        </div>

        {gagal && <div className="pesan pesan-gagal">{gagal}</div>}

        {mode === 'petugas' ? (
          <>
            <label htmlFor="kolom" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Users size={14} className="teks-penatua" />
              <span>Kolom / Kelompok</span>
            </label>
            <select id="kolom" className="input" value={kolomId} onChange={(e) => setKolomId(Number(e.target.value))} style={{ marginBottom: 16 }}>
              {daftarKolom.length === 0 ? (
                <option value={kolomId}>Memuat daftar kolom…</option>
              ) : (
                daftarKolom.map((k) => (
                  <option value={k.id} key={k.id}>{k.nama}</option>
                ))
              )}
            </select>
            <label htmlFor="kode" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <KeyRound size={14} className="teks-penatua" />
              <span>Kode Akses Kolom</span>
            </label>
            <input id="kode" type="password" className="input" value={kode} onChange={(e) => setKode(e.target.value)}
              placeholder="Kode dari panitia" required style={{ marginBottom: 20 }} />
          </>
        ) : (
          <>
            <label htmlFor="password" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Lock size={14} className="teks-penatua" />
              <span>Password Admin</span>
            </label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
              required style={{ marginBottom: 20 }} placeholder="Masukkan password admin" />
          </>
        )}

        <button className="btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={proses}>
          <LogIn size={16} />
          <span>{proses ? 'Memproses…' : 'Masuk ke Panel'}</span>
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.84rem' }}>
          <a href="/" style={{ color: 'var(--redup)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} />
            <span>Lihat Quick Count</span>
          </a>
        </p>
      </form>
    </div>
  );
}
