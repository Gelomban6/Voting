'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Tahap = 'penatua' | 'diaken' | 'selesai';
type Jabatan = 'penatua' | 'diaken';
interface Kandidat { id: string; jabatan: Jabatan; nama: string; suara: number; aklamasi?: boolean; foto: string | null }
interface DataPetugas {
  kolom: { id: number; nama: string; tahap: Tahap };
  penatua: Kandidat[];
  diaken: Kandidat[];
}

function inisial(nama: string): string {
  return nama.split(/\s+/).slice(0, 2).map((k) => k[0]?.toUpperCase() ?? '').join('');
}

export default function PanelPetugas() {
  const router = useRouter();
  const [data, setData] = useState<DataPetugas | null>(null);
  const [pesan, setPesan] = useState<{ jenis: 'sukses' | 'gagal'; teks: string } | null>(null);
  const [namaBaru, setNamaBaru] = useState<Record<Jabatan, string>>({ penatua: '', diaken: '' });
  const [sibuk, setSibuk] = useState(false);
  const relFile = useRef<HTMLInputElement>(null);
  const targetFoto = useRef<string | null>(null);

  const muat = useCallback(async () => {
    const res = await fetch('/api/petugas', { cache: 'no-store' });
    if (res.status === 401) { router.push('/login'); return; }
    const json = await res.json();
    if (!json.error) setData(json);
  }, [router]);

  // Muat awal + polling 30 detik: heartbeat "petugas aktif", sinkron data
  // antar perangkat, dan mendeteksi bila kolom ini login di perangkat lain
  useEffect(() => {
    muat();
    const timer = setInterval(muat, 30_000);
    return () => clearInterval(timer);
  }, [muat]);

  function tampilkan(jenis: 'sukses' | 'gagal', teks: string) {
    setPesan({ jenis, teks });
    setTimeout(() => setPesan(null), 4000);
  }

  async function panggil(url: string, body: object, metode = 'POST'): Promise<boolean> {
    setSibuk(true);
    try {
      const res = await fetch(url, {
        method: metode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { tampilkan('gagal', json.error ?? 'Terjadi kesalahan'); return false; }
      return true;
    } catch {
      tampilkan('gagal', 'Tidak dapat terhubung ke server');
      return false;
    } finally {
      setSibuk(false);
    }
  }

  // ==== Tally: +1 / -1 dengan pembaruan optimistis ====
  async function tally(k: Kandidat, delta: 1 | -1) {
    if (!data) return;
    if (delta === -1 && k.suara === 0) return;

    // Perbarui tampilan seketika
    setData((d) => {
      if (!d) return d;
      const ubah = (arr: Kandidat[]) =>
        arr.map((x) => (x.id === k.id ? { ...x, suara: Math.max(0, x.suara + delta) } : x));
      return { ...d, penatua: ubah(d.penatua), diaken: ubah(d.diaken) };
    });

    try {
      const res = await fetch('/api/petugas/tally', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kandidatId: k.id, delta }),
      });
      const json = await res.json();
      if (!res.ok) {
        tampilkan('gagal', json.error ?? 'Gagal menyimpan suara');
        muat(); // batalkan pembaruan optimistis
      } else {
        // Sinkronkan angka pasti dari server
        setData((d) => {
          if (!d) return d;
          const ubah = (arr: Kandidat[]) =>
            arr.map((x) => (x.id === k.id ? { ...x, suara: json.suara } : x));
          return { ...d, penatua: ubah(d.penatua), diaken: ubah(d.diaken) };
        });
      }
    } catch {
      tampilkan('gagal', 'Tidak dapat terhubung ke server');
      muat();
    }
  }

  async function tambahKandidat(jabatan: Jabatan) {
    const nama = namaBaru[jabatan].trim();
    if (!nama) return;
    if (await panggil('/api/petugas/kandidat', { nama, jabatan })) {
      setNamaBaru((p) => ({ ...p, [jabatan]: '' }));
      tampilkan('sukses', `Calon "${nama}" ditambahkan.`);
      muat();
    }
  }

  async function hapusKandidat(k: Kandidat) {
    if (!confirm(`Hapus calon "${k.nama}"?`)) return;
    if (await panggil('/api/petugas/kandidat', { id: k.id }, 'DELETE')) {
      tampilkan('sukses', 'Calon dihapus.');
      muat();
    }
  }

  // ==== Foto ====
  function pilihFoto(k: Kandidat) {
    targetFoto.current = k.id;
    relFile.current?.click();
  }

  async function unggahFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = targetFoto.current;
    if (!file || !id) return;

    const form = new FormData();
    form.append('id', String(id));
    form.append('foto', file);
    setSibuk(true);
    try {
      const res = await fetch('/api/petugas/kandidat/foto', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) tampilkan('gagal', json.error ?? 'Gagal mengunggah foto');
      else { tampilkan('sukses', 'Foto tersimpan.'); muat(); }
    } catch {
      tampilkan('gagal', 'Tidak dapat terhubung ke server');
    } finally {
      setSibuk(false);
    }
  }

  async function ubahTahap(tahap: Tahap) {
    if (await panggil('/api/petugas/tahap', { tahap })) muat();
  }

  // Aklamasi: diaken ditetapkan dari peringkat 2 suara penatua
  async function aklamasi() {
    if (!data) return;
    const urut = [...data.penatua].sort((a, b) => b.suara - a.suara);
    const kedua = urut[1];
    if (!kedua) {
      tampilkan('gagal', 'Aklamasi butuh minimal 2 calon penatua.');
      return;
    }
    const adaDiaken = data.diaken.length > 0;
    if (!confirm(
      `Tetapkan "${kedua.nama}" (peringkat 2 penatua, ${kedua.suara} suara) sebagai DIAKEN secara aklamasi?\n\n` +
      (adaDiaken ? 'Calon diaken yang sudah ada akan DIHAPUS. ' : '') +
      'Sesi voting diaken dilewati dan pemilihan kolom ini langsung selesai.'
    )) return;
    if (await panggil('/api/petugas/aklamasi', {})) {
      tampilkan('sukses', `"${kedua.nama}" ditetapkan sebagai diaken secara aklamasi.`);
      muat();
    }
  }

  async function keluar() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  if (!data) {
    return <p style={{ textAlign: 'center', padding: 60, color: 'var(--samar)' }}>Memuat…</p>;
  }

  const tahap = data.kolom.tahap;
  const urutan: Tahap[] = ['penatua', 'diaken', 'selesai'];
  const posisi = urutan.indexOf(tahap);

  function seksiTally(jabatan: Jabatan, judul: string) {
    const daftar = jabatan === 'penatua' ? data!.penatua : data!.diaken;
    const aktif = tahap === jabatan;
    const warna = jabatan === 'penatua' ? 'var(--biru)' : 'var(--amber)';
    const totalSeksi = daftar.reduce((a, k) => a + k.suara, 0);

    return (
      <div className="panel" style={{ opacity: aktif ? 1 : 0.75 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: '1.05rem', color: warna }}>
            {judul} <span style={{ color: 'var(--samar)', fontWeight: 400, fontSize: '.85rem' }}>· {totalSeksi} suara</span>
          </h2>
          {aktif
            ? <span className={`badge badge-${jabatan}`}><span className="titik" />Sedang Berlangsung</span>
            : <span style={{ fontSize: '.75rem', color: 'var(--samar)' }}>
                {posisi > urutan.indexOf(jabatan) ? '✓ tersimpan' : 'menunggu giliran'}
              </span>}
        </div>

        {daftar.length === 0 && <p className="teks-kosong" style={{ marginBottom: 12 }}>Belum ada calon.</p>}

        {daftar.map((k) => (
          <div key={k.id} className="baris-tally">
            {k.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar besar avatar-klik" src={k.foto} alt={k.nama}
                title="Klik untuk ganti foto" onClick={() => pilihFoto(k)} />
            ) : (
              <span className="avatar besar avatar-klik" title="Klik untuk pasang foto"
                onClick={() => pilihFoto(k)}>{inisial(k.nama)}</span>
            )}
            <span className="nama-tally">
              {k.nama}
              {k.aklamasi && <span style={{ marginLeft: 8, fontSize: '.68rem', fontWeight: 700, color: 'var(--hijau)', textTransform: 'uppercase', letterSpacing: '.8px' }}>aklamasi</span>}
            </span>
            <button className="btn-tally btn-tally-min" onClick={() => tally(k, -1)}
              disabled={!aktif || k.suara === 0} title="Koreksi (kurangi satu)">−</button>
            <span className="hitung">{k.suara}</span>
            <button className="btn-tally" onClick={() => tally(k, 1)}
              disabled={!aktif} title="Tambah satu suara">+1</button>
            <button className="btn btn-merah btn-kecil" onClick={() => hapusKandidat(k)}
              disabled={sibuk} title="Hapus calon">✕</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            className="input" placeholder={`Nama calon ${jabatan}…`}
            value={namaBaru[jabatan]}
            onChange={(e) => setNamaBaru((p) => ({ ...p, [jabatan]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tambahKandidat(jabatan); } }}
          />
          <button className="btn btn-sekunder" onClick={() => tambahKandidat(jabatan)} disabled={sibuk}>+ Calon</button>
        </div>

        {!aktif && (
          <p style={{ fontSize: '.75rem', color: 'var(--samar)', marginTop: 10, textAlign: 'center' }}>
            {posisi > urutan.indexOf(jabatan)
              ? 'Sesi ini sudah disimpan. Buka kembali tahap bila perlu koreksi.'
              : `Penghitungan ${judul.toLowerCase()} dimulai setelah sesi sebelumnya disimpan.`}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <input type="file" accept="image/jpeg,image/png,image/webp" ref={relFile}
        style={{ display: 'none' }} onChange={unggahFoto} />

      <nav className="nav-panel">
        <span className="merek">🗳️ {data.kolom.nama} — Panel Petugas</span>
        <a href="/" target="_blank">Lihat Quick Count ↗</a>
        <span className="spasi" />
        <a href="#" onClick={(e) => { e.preventDefault(); keluar(); }}>Keluar</a>
      </nav>

      <div className="wadah-sempit">
        {pesan && <div className={`pesan pesan-${pesan.jenis}`}>{pesan.teks}</div>}

        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div className="stepper">
              {(['penatua', 'diaken', 'selesai'] as Tahap[]).map((t, i) => (
                <span key={t} style={{ display: 'flex', alignItems: 'center' }}>
                  {i > 0 && <span className="garis-step" />}
                  <span className={`step ${t === tahap ? 'aktif' : posisi > i ? 'lewat' : ''}`}>
                    <span className="bulat">{posisi > i ? '✓' : i + 1}</span>
                    <span className="ket-step">{t === 'selesai' ? 'Selesai' : `Voting ${t[0].toUpperCase()}${t.slice(1)}`}</span>
                  </span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tahap === 'penatua' && (
                <>
                  <button className="btn" onClick={() => ubahTahap('diaken')} disabled={sibuk}>
                    💾 Simpan Sesi Penatua → Mulai Diaken
                  </button>
                  <button className="btn btn-sekunder" onClick={aklamasi} disabled={sibuk}
                    title="Diaken ditetapkan dari peringkat 2 suara penatua, tanpa voting diaken">
                    ✋ Aklamasi Diaken (Peringkat 2)
                  </button>
                </>
              )}
              {tahap === 'diaken' && (
                <>
                  <button className="btn btn-sekunder" onClick={() => ubahTahap('penatua')} disabled={sibuk}>
                    ← Buka Lagi Sesi Penatua
                  </button>
                  <button className="btn btn-hijau" onClick={() => ubahTahap('selesai')} disabled={sibuk}>
                    💾 Simpan &amp; Selesaikan Pemilihan
                  </button>
                </>
              )}
              {tahap === 'selesai' && (
                <button className="btn btn-sekunder" onClick={() => ubahTahap('diaken')} disabled={sibuk}>
                  Buka Kembali (koreksi)
                </button>
              )}
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: '.8rem', color: 'var(--redup)' }}>
            {tahap === 'selesai'
              ? '✓ Pemilihan kolom ini telah selesai dan seluruh suara tersimpan. Terima kasih!'
              : 'Tekan +1 setiap kali satu suara dibacakan. Angka langsung tersimpan dan tampil di quick count. Setelah penghitungan sesi ini rampung, tekan tombol Simpan untuk mengunci dan lanjut.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {seksiTally('penatua', 'Penatua')}
          {seksiTally('diaken', 'Diaken')}
        </div>
      </div>
    </>
  );
}
