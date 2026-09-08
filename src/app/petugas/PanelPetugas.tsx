'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Vote,
  ExternalLink,
  LogOut,
  Check,
  CheckCheck,
  Award,
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
} from 'lucide-react';

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
    if (!json.error) setData(json);
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
            <div className="relative group cursor-pointer" onClick={() => pilihFoto(k)} title="Klik untuk pasang/ganti foto">
              {k.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar besar avatar-klik" src={k.foto} alt={k.nama} />
              ) : (
                <span className="avatar besar avatar-klik">{inisial(k.nama)}</span>
              )}
            </div>
            <span className="nama-tally" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{k.nama}</span>
              {k.aklamasi && (
                <span style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--hijau)', textTransform: 'uppercase', letterSpacing: '.8px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Award size={11} /> aklamasi
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
        <a href="#" onClick={(e) => { e.preventDefault(); keluar(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <LogOut size={13} />
          <span>Keluar</span>
        </a>
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
                    <Award size={14} className="text-amber-400" />
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
