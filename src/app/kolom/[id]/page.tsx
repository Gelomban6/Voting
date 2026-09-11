'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Vote,
  Radio,
  Share2,
  QrCode,
  RotateCw,
  ArrowLeft,
  Check,
  CheckCircle2,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Copy,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { generateQRDataURL, unduhQRDataURL } from '@/lib/qr';

const REFRESH_MS = 3500;

type Tahap = 'penatua' | 'diaken' | 'selesai';

interface Kandidat {
  id: string;
  nama: string;
  foto: string | null;
  jabatan: 'penatua' | 'diaken';
  suara: number;
  aklamasi?: boolean;
}

interface Kolom {
  id: number;
  nama: string;
  tahap: Tahap;
  petugasAktif: boolean;
  penatua: Kandidat[];
  diaken: Kandidat[];
}

interface DataQC {
  kolom: Kolom[];
  totalSuara: number;
  kolomSelesai: number;
  waktu: string;
}

interface TrendKandidat {
  arah: 'naik' | 'turun' | 'tetap';
  perubahanSuara: number;
  perubahanLead: number;
  keterangan: string;
}

const TAHAP_LABEL: Record<Tahap, string> = {
  penatua: 'Voting Penatua',
  diaken: 'Voting Diaken',
  selesai: 'Selesai',
};

function inisial(nama: string): string {
  return nama
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function Avatar({ k, ukuran = 'standar' }: { k: Kandidat; ukuran?: 'standar' | 'besar' | 'jumbo' }) {
  const cls = `avatar ${ukuran}`;
  return k.foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={cls} src={k.foto} alt={k.nama} />
  ) : (
    <span className={cls}>{inisial(k.nama)}</span>
  );
}

// Odometer digit vertikal
const DERET_DIGIT = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function Odometer({ nilai }: { nilai: number }) {
  const safeNilai = Number.isFinite(nilai) ? Math.max(0, nilai) : 0;
  const teks = safeNilai.toLocaleString('id-ID');
  return (
    <span className="odo" aria-label={teks}>
      {teks.split('').map((huruf, i) =>
        /\d/.test(huruf) ? (
          <span className="odo-digit" key={`${teks.length}-${i}`}>
            <span className="odo-kolom" style={{ transform: `translateY(-${Number(huruf)}em)` }}>
              {DERET_DIGIT.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span className="odo-titik" key={`${teks.length}-${i}`}>
            {huruf}
          </span>
        )
      )}
    </span>
  );
}

// Menghitung delta & tren per kandidat
function hitungTrendKolom(
  kolom: Kolom,
  riwayatRef: React.MutableRefObject<Map<string, { suara: number; lead: number }>>
): Map<string, TrendKandidat> {
  const hasil = new Map<string, TrendKandidat>();

  for (const daftar of [kolom.penatua, kolom.diaken]) {
    if (!daftar.length) continue;
    const urut = [...daftar].sort((a, b) => b.suara - a.suara);
    const maks = urut[0]?.suara ?? 0;
    const peringkatDua = urut[1]?.suara ?? 0;
    const adaSuara = maks > 0;

    for (const kandidat of daftar) {
      const isLeader = kandidat.suara === maks && adaSuara;
      const currentLead = isLeader ? kandidat.suara - peringkatDua : kandidat.suara - maks;

      const prev = riwayatRef.current.get(kandidat.id);
      if (!prev) {
        riwayatRef.current.set(kandidat.id, { suara: kandidat.suara, lead: currentLead });
        hasil.set(kandidat.id, {
          arah: 'tetap',
          perubahanSuara: 0,
          perubahanLead: 0,
          keterangan: 'Belum ada perubahan suara',
        });
        continue;
      }

      const deltaSuara = kandidat.suara - prev.suara;
      const deltaLead = currentLead - prev.lead;

      let arah: 'naik' | 'turun' | 'tetap' = 'tetap';
      let keterangan = 'Stabil';

      if (deltaLead > 0) {
        arah = 'naik';
        keterangan = isLeader
          ? `Keunggulan bertambah +${deltaLead} suara`
          : `Mengejar ketertinggalan +${deltaLead} suara`;
      } else if (deltaLead < 0) {
        arah = 'turun';
        keterangan = isLeader
          ? `Keunggulan menyusut -${Math.abs(deltaLead)} suara`
          : `Jarak ketertinggalan melebar -${Math.abs(deltaLead)} suara`;
      } else if (deltaSuara > 0) {
        arah = 'naik';
        keterangan = `Suara bertambah +${deltaSuara} suara`;
      }

      riwayatRef.current.set(kandidat.id, { suara: kandidat.suara, lead: currentLead });
      hasil.set(kandidat.id, {
        arah,
        perubahanSuara: deltaSuara,
        perubahanLead: deltaLead,
        keterangan,
      });
    }
  }

  return hasil;
}

export default function HalamanPengamatKolom({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const targetId = parseInt(resolvedParams.id, 10);

  const [dataQC, setDataQC] = useState<DataQC | null>(null);
  const [mapTrend, setMapTrend] = useState<Map<string, TrendKandidat>>(new Map());
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [waktuPembaruan, setWaktuPembaruan] = useState<string>('');
  const [tampilModalQR, setTampilModalQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [pesanTersalin, setPesanTersalin] = useState(false);

  const riwayatRef = useRef<Map<string, { suara: number; lead: number }>>(new Map());

  // Ambil data real-time
  async function muatData() {
    try {
      const res = await fetch('/api/quickcount', { cache: 'no-store' });
      const json = await res.json();
      if (!json.error && Array.isArray(json.kolom)) {
        setDataQC(json);
        const k = json.kolom.find((item: Kolom) => item.id === targetId);
        if (k) {
          const trend = hitungTrendKolom(k, riwayatRef);
          setMapTrend(trend);
        }
        setWaktuPembaruan(new Date().toLocaleTimeString('id-ID', { hour12: false }));
        setGagal(false);
      } else {
        setGagal(true);
      }
    } catch {
      setGagal(true);
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muatData();
    const interval = setInterval(muatData, REFRESH_MS);
    return () => clearInterval(interval);
  }, [targetId]);

  const kolomAktif = dataQC?.kolom.find((k) => k.id === targetId);

  useEffect(() => {
    if (tampilModalQR && kolomAktif) {
      const url = typeof window !== 'undefined' ? window.location.href : `/kolom/${targetId}`;
      generateQRDataURL(url, 300).then(setQrDataUrl);
    }
  }, [tampilModalQR, kolomAktif, targetId]);

  useEffect(() => {
    if (!tampilModalQR) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setTampilModalQR(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tampilModalQR]);

  function salinTautan() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setPesanTersalin(true);
      setTimeout(() => setPesanTersalin(false), 3000);
    }
  }

  function bagikan() {
    if (typeof window !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `Hasil Pemilihan - ${kolomAktif?.nama ?? `Kolom ${targetId}`}`,
          text: `Pantau perolehan suara langsung (real-time) untuk ${kolomAktif?.nama ?? `Kolom ${targetId}`}`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      salinTautan();
    }
  }

  if (memuat) {
    return (
      <div className="layar-muat">
        <div className="roda-muat" />
        <p>Memuat hasil suara Kolom {targetId}...</p>
      </div>
    );
  }

  if (!kolomAktif || gagal) {
    return (
      <div className="layar-muat" style={{ gap: 16 }}>
        <p style={{ color: 'var(--merah)', fontWeight: 600 }}>
          Kolom {targetId} tidak ditemukan atau belum terdaftar.
        </p>
        <Link href="/" className="btn">
          <ArrowLeft size={16} />
          <span>Kembali ke Quick Count Umum</span>
        </Link>
      </div>
    );
  }

  const totalSuara = [...kolomAktif.penatua, ...kolomAktif.diaken].reduce(
    (acc, c) => acc + c.suara,
    0
  );

  const maksPenatua = Math.max(...kolomAktif.penatua.map((c) => c.suara), 1);
  const maksDiaken = Math.max(...kolomAktif.diaken.map((c) => c.suara), 1);

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--latar)', color: 'var(--teks)' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {/* Sisi Kiri: Tombol Kembali & Judul Stasiun */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Link
              href="/"
              className="btn btn-sekunder btn-kecil"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                flexShrink: 0,
              }}
              title="Kembali ke Quick Count Umum"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Semua Kolom</span>
              <span className="inline sm:hidden">Semua</span>
            </Link>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '.68rem',
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  color: 'var(--samar)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span>Stasiun Pemilihan</span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span style={{ color: 'var(--aksen)', fontWeight: 700 }}>Live</span>
              </div>
              <h1
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2,
                }}
              >
                {kolomAktif.nama}
              </h1>
            </div>
          </div>

          {/* Sisi Kanan: Aksi (QR Code, Bagikan, Segarkan) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setTampilModalQR(true)}
              className="btn btn-sekunder btn-kecil"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px' }}
              title="Tampilkan QR Code Stasiun Ini"
            >
              <QrCode size={15} className="text-sky-400" />
              <span className="hidden sm:inline">QR Code</span>
            </button>
            <button
              onClick={bagikan}
              className="btn btn-sekunder btn-kecil"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px' }}
              title="Bagikan Tautan Pemantau"
            >
              <Share2 size={14} />
              <span className="hidden md:inline">Bagikan</span>
            </button>
            <button
              onClick={muatData}
              className="btn btn-kecil"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 9px',
              }}
              title="Muat Ulang Sekarang"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 12px 24px' }}>
        {/* Status Card & Live Indicator */}
        <div
          className="panel"
          style={{
            marginBottom: 16,
            padding: '14px 16px',
            background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.98))',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 16,
          }}
        >
          {/* Baris Atas: Status Live, Tahap, Petugas */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              paddingBottom: 12,
              marginBottom: 12,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '.72rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 9999,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--hijau)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--hijau)',
                    boxShadow: '0 0 6px var(--hijau)',
                  }}
                />
                PEMANTAUAN LANGSUNG (LIVE)
              </span>

              <span
                style={{
                  fontSize: '.72rem',
                  padding: '3px 9px',
                  borderRadius: 9999,
                  background:
                    kolomAktif.tahap === 'selesai'
                      ? 'rgba(52, 211, 153, 0.15)'
                      : 'rgba(56, 189, 248, 0.15)',
                  color:
                    kolomAktif.tahap === 'selesai' ? 'var(--hijau)' : 'var(--aksen)',
                  fontWeight: 700,
                  border: `1px solid ${kolomAktif.tahap === 'selesai' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                }}
              >
                {TAHAP_LABEL[kolomAktif.tahap]}
              </span>
            </div>

            <div>
              {kolomAktif.petugasAktif ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '.72rem',
                    color: 'var(--hijau)',
                    fontWeight: 600,
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <Radio size={12} className="animate-pulse" /> Petugas Sedang Input
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '.72rem',
                    color: 'var(--samar)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                  }}
                >
                  Petugas Standby
                </span>
              )}
            </div>
          </div>

          {/* Baris Inti: Kotak Total Suara Terdata & Keterangan Waktu */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                flex: '1 1 auto',
                minWidth: 200,
                maxWidth: 360,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--aksen)',
                  flexShrink: 0,
                }}
              >
                <Vote size={22} />
              </div>
              <div>
                <div style={{ fontSize: '.68rem', color: 'var(--samar)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
                  Total Suara Terdata
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <Odometer nilai={totalSuara} />
                  <span style={{ fontSize: '.82rem', fontWeight: 500, color: 'var(--redup)' }}>suara</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '.78rem', color: 'var(--redup)', lineHeight: 1.4 }}>
              <div>Diperbarui pk. <strong style={{ color: 'var(--teks)', fontFamily: 'monospace' }}>{waktuPembaruan || '--:--:--'}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: 'var(--samar)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--aksen)', display: 'inline-block' }} />
                <span>Sinkronisasi otomatis setiap 3.5 detik</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Grid: Penatua & Diaken */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Penatua */}
          <div className="panel" style={{ borderTop: '3px solid var(--penatua)', padding: '14px 14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                paddingBottom: 10,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--penatua)',
                    display: 'inline-block',
                  }}
                />
                <span>Hasil Calon Penatua</span>
              </h2>
              <span
                style={{
                  fontSize: '.72rem',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--samar)',
                  fontWeight: 600,
                }}
              >
                {kolomAktif.penatua.length} Calon
              </span>
            </div>

            {kolomAktif.penatua.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 12px',
                  color: 'var(--redup)',
                  fontSize: '.84rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 10,
                  border: '1px dashed var(--border)',
                }}
              >
                Belum ada data calon penatua
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {kolomAktif.penatua.map((c, i) => {
                  const trend = mapTrend.get(c.id);
                  const isUnggul = i === 0 && c.suara > 0;
                  const deltaNilai = trend ? Math.abs(trend.perubahanLead || trend.perubahanSuara) : 0;
                  const persen = maksPenatua > 0 ? (c.suara / maksPenatua) * 100 : 0;

                  return (
                    <div
                      key={c.id}
                      className={`baris-hero ${isUnggul ? 'unggul penatua' : ''}`}
                      style={{ padding: '8px 12px', gap: 10 }}
                    >
                      <Avatar k={c} ukuran="besar" />
                      <div className="info-hero" style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="atas-hero"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span
                            className="hero-nama"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              minWidth: 0,
                              overflow: 'hidden',
                            }}
                          >
                            <span
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {c.nama}
                            </span>
                            {isUnggul && (
                              <span
                                style={{
                                  fontSize: '.62rem',
                                  padding: '1px 6px',
                                  borderRadius: 9999,
                                  background: 'rgba(56, 189, 248, 0.2)',
                                  color: '#38bdf8',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {kolomAktif.tahap === 'selesai' ? 'Terpilih' : 'Memimpin'}
                              </span>
                            )}
                          </span>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {trend && !c.aklamasi && (
                              <span
                                className={`trend-indicator trend-${trend.arah}`}
                                title={trend.keterangan}
                              >
                                {trend.arah === 'naik' && <TrendingUp size={11} strokeWidth={2.5} />}
                                {trend.arah === 'turun' && <TrendingDown size={11} strokeWidth={2.5} />}
                                {trend.arah === 'tetap' && <Minus size={10} />}
                                <span className="trend-val">
                                  {trend.arah === 'naik' && `+${deltaNilai > 0 ? deltaNilai : 1}`}
                                  {trend.arah === 'turun' && `-${deltaNilai > 0 ? deltaNilai : 1}`}
                                  {trend.arah === 'tetap' && '0'}
                                </span>
                              </span>
                            )}

                            <span className="hero-angka">
                              {c.aklamasi ? (
                                <span className="chip-aklamasi" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <UserCheck size={12} /> Aklamasi
                                </span>
                              ) : (
                                <Odometer nilai={c.suara} />
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="bar-mini bar-hero penatua" style={{ marginTop: 4 }}>
                          <div style={{ width: `${persen}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diaken */}
          <div className="panel" style={{ borderTop: '3px solid var(--diaken)', padding: '14px 14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                paddingBottom: 10,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--diaken)',
                    display: 'inline-block',
                  }}
                />
                <span>Hasil Calon Diaken</span>
              </h2>
              <span
                style={{
                  fontSize: '.72rem',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--samar)',
                  fontWeight: 600,
                }}
              >
                {kolomAktif.diaken.length} Calon
              </span>
            </div>

            {kolomAktif.diaken.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 12px',
                  color: 'var(--redup)',
                  fontSize: '.84rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 10,
                  border: '1px dashed var(--border)',
                }}
              >
                Belum ada data calon diaken
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {kolomAktif.diaken.map((c, i) => {
                  const trend = mapTrend.get(c.id);
                  const isUnggul = i === 0 && c.suara > 0;
                  const deltaNilai = trend ? Math.abs(trend.perubahanLead || trend.perubahanSuara) : 0;
                  const persen = maksDiaken > 0 ? (c.suara / maksDiaken) * 100 : 0;

                  return (
                    <div
                      key={c.id}
                      className={`baris-hero ${isUnggul ? 'unggul diaken' : ''}`}
                      style={{ padding: '8px 12px', gap: 10 }}
                    >
                      <Avatar k={c} ukuran="besar" />
                      <div className="info-hero" style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="atas-hero"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span
                            className="hero-nama"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              minWidth: 0,
                              overflow: 'hidden',
                            }}
                          >
                            <span
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {c.nama}
                            </span>
                            {isUnggul && (
                              <span
                                style={{
                                  fontSize: '.62rem',
                                  padding: '1px 6px',
                                  borderRadius: 9999,
                                  background: 'rgba(52, 211, 153, 0.2)',
                                  color: '#34d399',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {kolomAktif.tahap === 'selesai' ? 'Terpilih' : 'Memimpin'}
                              </span>
                            )}
                          </span>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {trend && !c.aklamasi && (
                              <span
                                className={`trend-indicator trend-${trend.arah}`}
                                title={trend.keterangan}
                              >
                                {trend.arah === 'naik' && <TrendingUp size={11} strokeWidth={2.5} />}
                                {trend.arah === 'turun' && <TrendingDown size={11} strokeWidth={2.5} />}
                                {trend.arah === 'tetap' && <Minus size={10} />}
                                <span className="trend-val">
                                  {trend.arah === 'naik' && `+${deltaNilai > 0 ? deltaNilai : 1}`}
                                  {trend.arah === 'turun' && `-${deltaNilai > 0 ? deltaNilai : 1}`}
                                  {trend.arah === 'tetap' && '0'}
                                </span>
                              </span>
                            )}

                            <span className="hero-angka">
                              {c.aklamasi ? (
                                <span className="chip-aklamasi" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <UserCheck size={12} /> Aklamasi
                                </span>
                              ) : (
                                <Odometer nilai={c.suara} />
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="bar-mini bar-hero diaken" style={{ marginTop: 4 }}>
                          <div style={{ width: `${persen}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Switcher Footer */}
        {dataQC && dataQC.kolom.length > 1 && (
          <div className="panel" style={{ marginTop: 20, padding: '14px 16px', borderRadius: 16 }}>
            <div
              style={{
                fontSize: '.76rem',
                color: 'var(--samar)',
                marginBottom: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Pindah ke Stasiun Kolom Lain:</span>
              <span style={{ fontSize: '.72rem', color: 'var(--redup)' }}>{dataQC.kolom.length} Kolom</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                gap: 8,
              }}
            >
              {dataQC.kolom.map((k) => (
                <Link
                  key={k.id}
                  href={`/kolom/${k.id}`}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 10,
                    fontSize: '.82rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    background: k.id === targetId ? 'var(--aksen)' : 'rgba(255, 255, 255, 0.05)',
                    color: k.id === targetId ? '#0f172a' : 'var(--teks)',
                    border: k.id === targetId ? '1px solid var(--aksen)' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    minHeight: 44,
                    textAlign: 'center',
                    transition: 'all .15s ease',
                  }}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {k.nama}
                  </span>
                  {k.tahap === 'selesai' && (
                    <CheckCircle2
                      size={12}
                      className={k.id === targetId ? 'text-slate-900' : 'text-emerald-400'}
                    />
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal QR Code Stasiun */}
      {tampilModalQR && (
        <div className="modal-overlay" onClick={() => setTampilModalQR(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-judul" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <QrCode size={20} className="text-sky-400" />
              <span>QR Code {kolomAktif.nama}</span>
            </div>
            <p className="modal-pesan" style={{ marginBottom: 16 }}>
              Arahkan kamera ponsel lain ke QR Code di bawah untuk langsung membuka hasil
              suara real-time {kolomAktif.nama}.
            </p>

            <div className="kartu-qr-single">
              <div className="img-qr-wadah">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt={`QR Code ${kolomAktif.nama}`} />
                ) : (
                  <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--samar)' }}>
                    Menghasilkan QR Code...
                  </div>
                )}
              </div>
              <div className="tautan-qr-teks">
                {typeof window !== 'undefined' ? window.location.href : `/kolom/${targetId}`}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-sekunder btn-kecil"
                  onClick={salinTautan}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Copy size={13} />
                  <span>{pesanTersalin ? 'Tersalin!' : 'Salin Tautan'}</span>
                </button>
                {qrDataUrl && (
                  <button
                    type="button"
                    className="btn btn-sekunder btn-kecil"
                    onClick={() => unduhQRDataURL(qrDataUrl, `QR_${kolomAktif.nama.replace(/\s+/g, '_')}.png`)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Share2 size={13} />
                    <span>Unduh PNG</span>
                  </button>
                )}
              </div>
            </div>

            <div className="modal-aksi" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setTampilModalQR(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
