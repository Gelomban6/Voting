'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Vote,
  ExternalLink,
  LogOut,
  Check,
  CheckCheck,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Save,
  Plus,
  Minus,
  Trash2,
  Camera,
  AlertTriangle,
  HelpCircle,
  Users,
} from 'lucide-react';

type Tahap = 'penatua' | 'diaken' | 'selesai';
type Jabatan = 'penatua' | 'diaken';
interface Kandidat { id: string; jabatan: Jabatan; nama: string; suara: number; aklamasi?: boolean; foto: string | null }
interface DataPetugas {
  kolom: { id: number; nama: string; tahap: Tahap; jumlahPemilih?: number };
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
  const [jumlahPemilihInput, setJumlahPemilihInput] = useState('');
  const [simpanDptSibuk, setSimpanDptSibuk] = useState(false);
  const sedangEditDpt = useRef(false);
  const [sibuk, setSibuk] = useState(false);
  const [modalKonfirmasi, setModalKonfirmasi] = useState<{
    judul: string;
    pesan: string;
    aksiLabel: string;
    bahaya?: boolean;
    onKonfirmasi: () => Promise<void> | void;
  } | null>(null);
  const relFile = useRef<HTMLInputElement>(null);
  const targetFoto = useRef<string | null>(null);

  const muat = useCallback(async () => {
    const res = await fetch('/api/petugas', { cache: 'no-store' });
    if (res.status === 401) { router.push('/login'); return; }
    const json = await res.json();
    if (!json.error) {
      setData(json);
      if (!sedangEditDpt.current) {
        setJumlahPemilihInput(
          json.kolom?.jumlahPemilih && json.kolom.jumlahPemilih > 0
            ? String(json.kolom.jumlahPemilih)
            : ''
        );
      }
    }
  }, [router]);

  // Muat awal dan polling berkala untuk sinkronisasi data antar perangkat
  useEffect(() => {
    muat();
    const timer = setInterval(muat, 30_000);
    return () => clearInterval(timer);
  }, [muat]);

  useEffect(() => {
    if (!modalKonfirmasi) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalKonfirmasi(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalKonfirmasi]);

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

  async function tally(k: Kandidat, delta: 1 | -1) {
    if (!data) return;
    if (delta === -1 && k.suara === 0) return;

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
        muat();
      } else {
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

  async function simpanJumlahPemilih(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const bersih = jumlahPemilihInput.trim();
    const angka = bersih === '' ? 0 : Number(bersih);

    if (!Number.isInteger(angka) || angka < 0 || angka > 50000) {
      tampilkan('gagal', 'Jumlah pemilih harus berupa angka bulat antara 0 dan 50.000');
      return;
    }

    setSimpanDptSibuk(true);
    try {
      const res = await fetch('/api/petugas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jumlahPemilih: angka }),
      });
      const json = await res.json();
      if (!res.ok) {
        tampilkan('gagal', json.error ?? 'Gagal menyimpan jumlah pemilih');
      } else {
        sedangEditDpt.current = false;
        setData((d) => (d ? { ...d, kolom: { ...d.kolom, jumlahPemilih: angka } } : d));
        tampilkan('sukses', 'Pengaturan jumlah pemilih terdaftar (DPT) berhasil disimpan.');
      }
    } catch {
      tampilkan('gagal', 'Tidak dapat terhubung ke server');
    } finally {
      setSimpanDptSibuk(false);
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

  function hapusKandidat(k: Kandidat) {
    setModalKonfirmasi({
      judul: 'Hapus Calon',
      pesan: `Hapus calon "${k.nama}" beserta perolehan suaranya (${k.suara} suara)?`,
      aksiLabel: 'Hapus Calon',
      bahaya: true,
      onKonfirmasi: async () => {
        if (await panggil('/api/petugas/kandidat', { id: k.id }, 'DELETE')) {
          tampilkan('sukses', `Calon "${k.nama}" dihapus.`);
          muat();
        }
      },
    });
  }

  function pilihFoto(k: Kandidat) {
    targetFoto.current = k.id;
    relFile.current?.click();
  }

  // Kompresi dan resize gambar di sisi klien sebelum dikirim ke server
  async function kompresGambar(file: File, lebarMaks = 480, kualitas = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > lebarMaks || height > lebarMaks) {
            if (width > height) {
              height = Math.round((height * lebarMaks) / width);
              width = lebarMaks;
            } else {
              width = Math.round((width * lebarMaks) / height);
              height = lebarMaks;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else resolve(file);
            },
            'image/jpeg',
            kualitas
          );
        };
        img.onerror = () => reject(new Error('Gagal membaca format gambar'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Gagal memuat file'));
      reader.readAsDataURL(file);
    });
  }

  async function unggahFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const kid = targetFoto.current;
    if (!file || !kid) return;
    e.target.value = '';

    setSibuk(true);
    try {
      const blobTerkonversi = await kompresGambar(file, 480, 0.85);

      const form = new FormData();
      form.append('id', kid);
      form.append('foto', blobTerkonversi, 'foto.jpg');

      const res = await fetch('/api/petugas/kandidat/foto', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) tampilkan('gagal', json.error ?? 'Gagal mengunggah foto');
      else { tampilkan('sukses', 'Foto berhasil disimpan.'); muat(); }
    } catch {
      tampilkan('gagal', 'Tidak dapat terhubung ke server');
    } finally {
      setSibuk(false);
    }
  }

  async function ubahTahap(tahap: Tahap) {
    if (await panggil('/api/petugas/tahap', { tahap })) muat();
  }

  function selesaikanPemilihan() {
    if (!data) return;
    if (data.diaken.length === 0) {
      tampilkan('gagal',
        'Belum ada calon diaken. Tambahkan calon dan hitung suaranya, ' +
        'atau kembali ke sesi penatua untuk memakai aklamasi.');
      return;
    }
    if (!data.diaken.some((k) => k.suara > 0)) {
      tampilkan('gagal', 'Belum ada suara untuk calon diaken. Hitung suaranya dulu sebelum menyelesaikan pemilihan.');
      return;
    }
    setModalKonfirmasi({
      judul: 'Selesaikan Pemilihan',
      pesan: 'Seluruh penghitungan suara untuk Penatua dan Diaken di kolom ini akan dikunci dan dinyatakan selesai. Lanjutkan?',
      aksiLabel: 'Selesaikan & Kunci',
      bahaya: false,
      onKonfirmasi: async () => {
        await ubahTahap('selesai');
      },
    });
  }

  async function aklamasi() {
    if (!data) return;
    const urut = [...data.penatua].sort((a, b) => b.suara - a.suara);
    const kedua = urut[1];
    if (!kedua) {
      tampilkan('gagal', 'Aklamasi butuh minimal 2 calon penatua.');
      return;
    }
    const adaDiaken = data.diaken.length > 0;
    setModalKonfirmasi({
      judul: 'Aklamasi Diaken',
      pesan: `Tetapkan "${kedua.nama}" (peringkat 2 penatua, ${kedua.suara} suara) sebagai DIAKEN secara aklamasi?\n\n` +
        (adaDiaken ? 'Perhatian: Calon diaken yang sudah ada sebelumnya akan dihapus. ' : '') +
        'Sesi voting diaken dilewati dan pemilihan kolom ini langsung selesai.',
      aksiLabel: 'Tetapkan Aklamasi',
      bahaya: adaDiaken,
      onKonfirmasi: async () => {
        if (await panggil('/api/petugas/aklamasi', {})) {
          tampilkan('sukses', `"${kedua.nama}" ditetapkan sebagai diaken secara aklamasi.`);
          muat();
        }
      },
    });
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

  const dpt = data.kolom.jumlahPemilih ?? 0;
  const totalPenatua = data.penatua.reduce((a, k) => a + k.suara, 0);
  const totalDiaken = data.diaken.reduce((a, k) => a + k.suara, 0);
  const suaraTahapAktif = tahap === 'diaken' ? totalDiaken : totalPenatua;
  const persenPartisipasi = dpt > 0 ? (suaraTahapAktif / dpt) * 100 : 0;
  const persenPenatua = dpt > 0 ? (totalPenatua / dpt) * 100 : 0;
  const persenDiaken = dpt > 0 ? (totalDiaken / dpt) * 100 : 0;
  const overDpt = dpt > 0 && suaraTahapAktif > dpt;

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
          {aktif ? (
            <span className={`badge badge-${jabatan}`}><span className="titik" />Sedang Berlangsung</span>
          ) : (
            <span style={{ fontSize: '.75rem', color: 'var(--samar)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {posisi > urutan.indexOf(jabatan) ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span>tersimpan</span>
                </>
              ) : (
                'menunggu giliran'
              )}
            </span>
          )}
        </div>

        {daftar.length === 0 && <p className="teks-kosong" style={{ marginBottom: 12 }}>Belum ada calon.</p>}

        {daftar.map((k) => (
          <div key={k.id} className="baris-tally">
            <button
              type="button"
              className="relative group cursor-pointer"
              onClick={() => pilihFoto(k)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pilihFoto(k); } }}
              title="Klik untuk pasang/ganti foto"
              aria-label={`Ubah foto calon ${k.nama}`}
              style={{ background: 'transparent', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', display: 'flex' }}
            >
              {k.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar besar avatar-klik" src={k.foto} alt={k.nama} />
              ) : (
                <span className="avatar besar avatar-klik">{inisial(k.nama)}</span>
              )}
            </button>
            <span className="nama-tally" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{k.nama}</span>
              {k.aklamasi && (
                <span style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--hijau)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <UserCheck size={11} /> aklamasi
                </span>
              )}
            </span>
            <button className="btn-tally btn-tally-min" onClick={() => tally(k, -1)}
              disabled={!aktif || k.suara === 0} title="Koreksi (kurangi satu)">
              <Minus size={14} />
            </button>
            <span className="hitung">{k.suara}</span>
            <button className="btn-tally" onClick={() => tally(k, 1)}
              disabled={!aktif} title="Tambah satu suara">
              <Plus size={13} style={{ display: 'inline', marginRight: 1 }} />1
            </button>
            <button className="btn btn-merah btn-kecil" onClick={() => hapusKandidat(k)}
              disabled={sibuk} title="Hapus calon" style={{ padding: '6px 9px' }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            className="input" placeholder={`Nama calon ${jabatan}…`}
            aria-label={`Nama calon ${jabatan}`}
            value={namaBaru[jabatan]}
            onChange={(e) => setNamaBaru((p) => ({ ...p, [jabatan]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tambahKandidat(jabatan); } }}
          />
          <button className="btn btn-sekunder" onClick={() => tambahKandidat(jabatan)} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Plus size={14} />
            <span>Calon</span>
          </button>
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
        aria-label="Unggah foto calon"
        style={{ display: 'none' }} onChange={unggahFoto} />

      <nav className="nav-panel">
        <span className="merek" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Vote size={18} className="text-sky-400" />
          <span>{data.kolom.nama} · Panel Petugas</span>
        </span>
        <a href="/" target="_blank" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span>Lihat Quick Count</span>
          <ExternalLink size={13} />
        </a>
        <span className="spasi" />
        <button
          type="button"
          onClick={keluar}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--redup)',
            fontSize: '.9rem',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            cursor: 'pointer',
            padding: '0 8px',
            fontFamily: 'inherit',
          }}
        >
          <LogOut size={13} />
          <span>Keluar</span>
        </button>
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
                    <span className="bulat" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {posisi > i ? <Check size={12} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="ket-step">{t === 'selesai' ? 'Selesai' : `Voting ${t[0].toUpperCase()}${t.slice(1)}`}</span>
                  </span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tahap === 'penatua' && (
                <>
                  <button className="btn" onClick={() => ubahTahap('diaken')} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Save size={14} />
                    <span>Simpan Sesi Penatua</span>
                    <ArrowRight size={14} />
                  </button>
                  <button className="btn btn-sekunder" onClick={aklamasi} disabled={sibuk}
                    title="Diaken ditetapkan dari peringkat 2 suara penatua, tanpa voting diaken"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <UserCheck size={14} className="text-amber-400" />
                    <span>Aklamasi Diaken (Peringkat 2)</span>
                  </button>
                </>
              )}
              {tahap === 'diaken' && (
                <>
                  <button className="btn btn-sekunder" onClick={() => ubahTahap('penatua')} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft size={14} />
                    <span>Buka Sesi Penatua</span>
                  </button>
                  <button className="btn btn-hijau" onClick={selesaikanPemilihan} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <CheckCheck size={14} />
                    <span>Simpan &amp; Selesaikan Pemilihan</span>
                  </button>
                </>
              )}
              {tahap === 'selesai' && (
                <button className="btn btn-sekunder" onClick={() => ubahTahap('diaken')} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={14} />
                  <span>Buka Kembali (Koreksi)</span>
                </button>
              )}
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: '.8rem', color: 'var(--redup)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {tahap === 'selesai' ? (
              <>
                <Check size={14} className="text-emerald-400" />
                <span>Pemilihan kolom ini telah selesai dan seluruh suara tersimpan. Terima kasih!</span>
              </>
            ) : (
              <span>
                Tekan <strong>+1</strong> setiap kali satu suara dibacakan. Angka langsung tersimpan dan tampil di quick count. Setelah penghitungan sesi rampung, tekan tombol Simpan untuk mengunci dan lanjut.
              </span>
            )}
          </p>
        </div>

        {/* Panel Pengaturan Jumlah Pemilih & Statistik Partisipasi */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} className="text-sky-400" />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                Pengaturan Jumlah Pemilih Terdaftar (DPT)
              </h2>
            </div>
            {dpt > 0 ? (
              <span
                style={{
                  fontSize: '.75rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: 'var(--biru)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                DPT: {dpt.toLocaleString('id-ID')} pemilih
              </span>
            ) : (
              <span
                style={{
                  fontSize: '.75rem',
                  color: 'var(--samar)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.05)',
                }}
              >
                DPT belum diatur
              </span>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
              alignItems: 'start',
            }}
          >
            {/* Formulir Pengaturan DPT */}
            <div>
              <form
                onSubmit={simpanJumlahPemilih}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <label
                  htmlFor="input-dpt-petugas"
                  style={{ fontSize: '.82rem', color: 'var(--redup)', fontWeight: 600 }}
                >
                  Jumlah Pemilih Terdaftar (Kolom {data.kolom.id}):
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    id="input-dpt-petugas"
                    type="number"
                    min="0"
                    max="50000"
                    placeholder="Contoh: 150"
                    className="input"
                    value={jumlahPemilihInput}
                    onFocus={() => {
                      sedangEditDpt.current = true;
                    }}
                    onChange={(e) => {
                      sedangEditDpt.current = true;
                      setJumlahPemilihInput(e.target.value);
                    }}
                    style={{ maxWidth: 170, minHeight: 44, fontWeight: 700 }}
                  />
                  <button
                    type="submit"
                    className="btn"
                    disabled={simpanDptSibuk}
                    style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Save size={14} />
                    <span>Simpan</span>
                  </button>
                </div>
                <span style={{ fontSize: '.75rem', color: 'var(--samar)' }}>
                  Gunakan angka DPT resmi jemaat sebagai acuan persentase kehadiran dan partisipasi suara.
                </span>
              </form>
            </div>

            {/* Statistik & Tingkat Partisipasi */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--redup)' }}>
                  Total Pemilih Memilih: {suaraTahapAktif} dari {dpt > 0 ? `${dpt.toLocaleString('id-ID')} DPT` : 'DPT belum diatur'}
                </span>
                <span
                  style={{
                    fontSize: '.9rem',
                    fontWeight: 800,
                    color: overDpt ? 'var(--merah)' : 'var(--biru)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {dpt > 0 ? `${persenPartisipasi.toFixed(1)}% partisipasi` : '0%'}
                </span>
              </div>

              {/* Progress Bar Partisipasi */}
              <div
                style={{
                  height: 9,
                  background: 'var(--panel-2)',
                  borderRadius: 99,
                  overflow: 'hidden',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, persenPartisipasi)}%`,
                    background: overDpt
                      ? 'var(--merah)'
                      : 'linear-gradient(90deg, var(--biru-tua), var(--biru))',
                    borderRadius: 99,
                    transition: 'width .4s ease',
                  }}
                />
              </div>

              {/* Rincian Suara vs DPT */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '.75rem',
                  color: 'var(--samar)',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <span>
                  Penatua: <strong>{totalPenatua}</strong> pemilih
                  {dpt > 0 && ` (${persenPenatua.toFixed(1)}%)`}
                </span>
                <span>
                  Diaken: <strong>{totalDiaken}</strong> pemilih
                  {dpt > 0 && ` (${persenDiaken.toFixed(1)}%)`}
                </span>
                <span>
                  Total suara masuk: <strong>{totalPenatua + totalDiaken}</strong> suara
                </span>
              </div>

              {overDpt && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'var(--merah)',
                    fontSize: '.75rem',
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid rgba(248, 113, 113, 0.2)',
                  }}
                >
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  <span>
                    Perhatian: Suara masuk ({suaraTahapAktif}) melebihi DPT ({dpt}). Periksa kemungkinan kesalahan tally.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {seksiTally('penatua', 'Penatua')}
          {seksiTally('diaken', 'Diaken')}
        </div>
      </div>

      {modalKonfirmasi && (
        <div className="modal-overlay" onClick={() => setModalKonfirmasi(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-judul" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {modalKonfirmasi.bahaya ? <AlertTriangle size={18} className="text-rose-400" /> : <HelpCircle size={18} className="text-sky-400" />}
              <span>{modalKonfirmasi.judul}</span>
            </div>
            <div className="modal-pesan">{modalKonfirmasi.pesan}</div>
            <div className="modal-aksi">
              <button
                type="button"
                className="btn btn-sekunder"
                onClick={() => setModalKonfirmasi(null)}
                disabled={sibuk}
              >
                Batal
              </button>
              <button
                type="button"
                className={`btn ${modalKonfirmasi.bahaya ? 'btn-merah' : 'btn-hijau'}`}
                onClick={async () => {
                  const aksi = modalKonfirmasi.onKonfirmasi;
                  setModalKonfirmasi(null);
                  await aksi();
                }}
                disabled={sibuk}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {modalKonfirmasi.bahaya ? <Trash2 size={14} /> : <Check size={14} />}
                <span>{modalKonfirmasi.aksiLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
