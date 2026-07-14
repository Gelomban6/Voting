'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  const gayaTab = (aktif: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '.9rem',
    background: aktif ? 'var(--biru-tua)' : 'transparent',
    color: aktif ? '#fff' : 'var(--redup)',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="panel" style={{ width: '100%', maxWidth: 400, padding: 32 }} onSubmit={masuk}>
        <h1 style={{ fontSize: '1.2rem', textAlign: 'center' }}>🗳️ Login Petugas</h1>
        <p style={{ textAlign: 'center', color: 'var(--redup)', fontSize: '.85rem', margin: '6px 0 22px' }}>
          Pemilihan Penatua &amp; Diaken
        </p>

        <div style={{ display: 'flex', gap: 6, background: 'var(--bg)', borderRadius: 12, padding: 5, marginBottom: 20 }}>
          <button type="button" style={gayaTab(mode === 'petugas')} onClick={() => setMode('petugas')}>
            Petugas Kolom
          </button>
          <button type="button" style={gayaTab(mode === 'admin')} onClick={() => setMode('admin')}>
            Admin
          </button>
        </div>

        {gagal && <div className="pesan pesan-gagal">{gagal}</div>}

        {mode === 'petugas' ? (
          <>
            <label htmlFor="kolom">Kolom / Kelompok</label>
            <select id="kolom" className="input" value={kolomId} onChange={(e) => setKolomId(Number(e.target.value))} style={{ marginBottom: 16 }}>
              {daftarKolom.length === 0 ? (
                <option value={kolomId}>Memuat daftar kolom…</option>
              ) : (
                daftarKolom.map((k) => (
                  <option value={k.id} key={k.id}>{k.nama}</option>
                ))
              )}
            </select>
            <label htmlFor="kode">Kode Akses Kolom</label>
            <input id="kode" type="password" className="input" value={kode} onChange={(e) => setKode(e.target.value)}
              placeholder="Kode dari panitia" required style={{ marginBottom: 20 }} />
          </>
        ) : (
          <>
            <label htmlFor="password">Password Admin</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
              required style={{ marginBottom: 20 }} />
          </>
        )}

        <button className="btn" style={{ width: '100%' }} disabled={proses}>
          {proses ? 'Memproses…' : 'Masuk'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: '.82rem' }}>
          <a href="/">&larr; Lihat quick count</a>
        </p>
      </form>
    </div>
  );
}
