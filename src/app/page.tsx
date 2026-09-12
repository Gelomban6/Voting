'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Lock,
  Pause,
  Play,
  UserCheck,
  Vote,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

const REFRESH_MS = 4000;
const GESER_OTOMATIS_MS = 4000;
const LEBAR_NAV_BAWAAN = 216;
const JARAK_NAV = 14;

type Tahap = 'penatua' | 'diaken' | 'selesai';
interface Kandidat { id: string; nama: string; suara: number; aklamasi?: boolean; foto: string | null }
interface Kolom {
  id: number;
  nama: string;
  tahap: Tahap;
  jumlahPemilih?: number;
  pemilihMemilih?: number;
  suaraPenatua?: number;
  suaraDiaken?: number;
  petugasAktif: boolean;
  penatua: Kandidat[];
  diaken: Kandidat[];
}
interface DataQC {
  kolom: Kolom[];
  totalSuara: number;
  totalDpt?: number;
  totalPemilihMemilih?: number;
  persenPartisipasi?: string;
  kolomSelesai: number;
  waktu: string;
}

export interface TrendKandidat {
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
  return nama.split(/\s+/).slice(0, 2).map((k) => k[0]?.toUpperCase() ?? '').join('');
}

function Avatar({ k, ukuran }: { k: Kandidat; ukuran?: 'mini' | 'besar' | 'jumbo' }) {
  const cls = `avatar ${ukuran ?? ''}`;
  return k.foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={cls} src={k.foto} alt={k.nama} />
  ) : (
    <span className={cls}>{inisial(k.nama)}</span>
  );
}

function totalKolom(k: Kolom): number {
  return [...k.penatua, ...k.diaken].reduce((a, c) => a + c.suara, 0);
}

// Menentukan pemenang atau status seri berdasarkan data terkini
function hasilAkhir(kandidat: Kandidat[]): { menang: Kandidat | null; seri: Kandidat[] } {
  if (!kandidat.length) return { menang: null, seri: [] };
  const maks = Math.max(...kandidat.map((k) => k.suara));
  if (maks <= 0) return { menang: null, seri: [] };
  const teratas = kandidat.filter((k) => k.suara === maks);
  if (teratas.length === 1) return { menang: teratas[0], seri: [] };
  return { menang: null, seri: teratas };
}

function SeksiTerpilihUtuh({
  judul,
  warna,
  kandidat,
}: {
  judul: string;
  warna: 'penatua' | 'diaken';
  kandidat: Kandidat[];
}) {
  const { menang, seri } = hasilAkhir(kandidat);
  const totalSuaraJabatan = kandidat.reduce((sum, c) => sum + c.suara, 0);
  const runnerUps = menang
    ? kandidat.filter((c) => c.id !== menang.id).sort((a, b) => b.suara - a.suara)
    : [];

  return (
    <div className={`seksi-terpilih-utuh ${warna}`}>
      <div className="seksi-terpilih-header">
        <div className={`label-jabatan-terpilih ${warna}`}>
          <UserCheck size={16} />
          <span>{judul}</span>
        </div>
        <div className="seksi-terpilih-suara-total">
          {totalSuaraJabatan} suara sah
        </div>
      </div>

      {menang ? (
        <div className="terpilih-fokus-kartu">
          <div className="terpilih-fokus-atas">
            <span className="avatar-cek-hero">
              <Avatar k={menang} ukuran="jumbo" />
              <span className="cek-badge-hero" aria-label="Terpilih">
                <Check size={16} strokeWidth={3.5} />
              </span>
            </span>
            <div className="terpilih-fokus-info">
              <div className="terpilih-nama-hero">{menang.nama}</div>
              {menang.aklamasi ? (
                <div className="terpilih-aklamasi-hero">
                  <span className="chip-aklamasi-hero">
                    <UserCheck size={13} /> Terpilih Aklamasi
                  </span>
                  <div className="terpilih-aklamasi-ket">
                    Mendapat persetujuan bulat jemaat
                  </div>
                </div>
              ) : (
                <div className="terpilih-suara-hero">
                  <div className="terpilih-angka-hero">
                    <Odometer nilai={menang.suara} />
                    <span className="satuan-hero">suara</span>
                  </div>
                  <div className="terpilih-persen-hero">
                    {totalSuaraJabatan > 0
                      ? ((menang.suara / totalSuaraJabatan) * 100).toFixed(1)
                      : '100'}% perolehan
                  </div>
                </div>
              )}
            </div>
          </div>

          {!menang.aklamasi && totalSuaraJabatan > 0 && (
            <div className={`bar-mini bar-hero ${warna}`} style={{ marginTop: 12, height: 8 }}>
              <div style={{ width: `${(menang.suara / totalSuaraJabatan) * 100}%` }} />
            </div>
          )}

          {runnerUps.length > 0 && (
            <div className="terpilih-rincian-lain">
              <div className="terpilih-rincian-label">Perolehan Calon Lainnya:</div>
              <div className="terpilih-rincian-list">
                {runnerUps.map((c) => {
                  const persen =
                    totalSuaraJabatan > 0 ? ((c.suara / totalSuaraJabatan) * 100).toFixed(1) : '0';
                  return (
                    <div key={c.id} className="terpilih-baris-lain">
                      <Avatar k={c} ukuran="mini" />
                      <span className="nama-lain">{c.nama}</span>
                      <span className="suara-lain">
                        <Odometer nilai={c.suara} /> suara ({persen}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : seri.length > 1 ? (
        <div className="terpilih-fokus-kartu terpilih-kartu-seri">
          <div className="terpilih-seri-avatar">
            {seri.slice(0, 3).map((k) => (
              <Avatar k={k} ukuran="besar" key={k.id} />
            ))}
          </div>
          <div className="terpilih-nama-hero">{seri.map((k) => k.nama).join(' & ')}</div>
          <div className="terpilih-seri-angka">
            Seri masing-masing {seri[0].suara} suara
          </div>
          <div className="terpilih-seri-pesan">
            Perolehan suara berimbang. Menunggu pemungutan suara putaran kedua.
          </div>
        </div>
      ) : (
        <div className="teks-kosong" style={{ padding: '24px 0' }}>
          Belum ada suara tercatat untuk jabatan ini
        </div>
      )}
    </div>
  );
}

// Odometer gulir vertikal untuk pembaruan angka
const DERET_DIGIT = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function Odometer({ nilai }: { nilai: number }) {
  const teks = nilai.toLocaleString('id-ID');
  return (
    <span className="odo" aria-label={teks}>
      {teks.split('').map((huruf, i) =>
        /\d/.test(huruf) ? (
          <span className="odo-digit" key={`${teks.length}-${i}`}>
            <span className="odo-kolom" style={{ transform: `translateY(-${Number(huruf)}em)` }}>
              {DERET_DIGIT.map((d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        ) : (
          <span key={`${teks.length}-${i}`}>{huruf}</span>
        )
      )}
    </span>
  );
}

// Analisis delta perolehan suara dan keunggulan terhadap pemuncak
function hitungTrendSemuaKolom(
  kolomBaru: Kolom[],
  riwayatRef: React.MutableRefObject<Map<string, { suara: number; lead: number }>>
): Map<string, TrendKandidat> {
  const hasilTrend = new Map<string, TrendKandidat>();

  for (const k of kolomBaru) {
    for (const daftar of [k.penatua, k.diaken]) {
      if (!daftar.length) continue;
      const urut = [...daftar].sort((a, b) => b.suara - a.suara);
      const maks = urut[0]?.suara ?? 0;
      const peringkatDua = urut[1]?.suara ?? 0;
      const adaSuara = maks > 0;

      for (const kandidat of daftar) {
        const isLeader = kandidat.suara === maks && adaSuara;
        const currentLead = isLeader ? (kandidat.suara - peringkatDua) : (kandidat.suara - maks);

        const prev = riwayatRef.current.get(kandidat.id);
        if (!prev) {
          riwayatRef.current.set(kandidat.id, { suara: kandidat.suara, lead: currentLead });
          hasilTrend.set(kandidat.id, {
            arah: 'tetap',
            perubahanSuara: 0,
            perubahanLead: 0,
            keterangan: 'Belum ada perubahan sejak awal pemantauan',
          });
          continue;
        }

        const deltaSuara = kandidat.suara - prev.suara;
        const deltaLead = currentLead - prev.lead;

        let arah: 'naik' | 'turun' | 'tetap' = 'tetap';
        let keterangan = 'Tidak ada perubahan';

        if (deltaLead > 0) {
          arah = 'naik';
          keterangan = isLeader
            ? `Keunggulan bertambah +${deltaLead} suara sejak pembaruan terakhir`
            : `Mengejar ketertinggalan +${deltaLead} suara ke pemuncak`;
        } else if (deltaLead < 0) {
          arah = 'turun';
          keterangan = isLeader
            ? `Keunggulan menyusut -${Math.abs(deltaLead)} suara sejak pembaruan terakhir`
            : `Jarak ketertinggalan melebar -${Math.abs(deltaLead)} suara`;
        } else if (deltaSuara > 0) {
          arah = 'naik';
          keterangan = `Suara bertambah +${deltaSuara} suara`;
        } else if (deltaSuara < 0) {
          arah = 'turun';
          keterangan = `Suara berkurang ${deltaSuara} suara`;
        } else {
          arah = 'tetap';
          keterangan = 'Stabil (suara tetap)';
        }

        riwayatRef.current.set(kandidat.id, { suara: kandidat.suara, lead: currentLead });
        hasilTrend.set(kandidat.id, {
          arah,
          perubahanSuara: deltaSuara,
          perubahanLead: deltaLead,
          keterangan,
        });
      }
    }
  }

  return hasilTrend;
}

function BarisHero({ k, warna, maks, unggul, trend }: {
  k: Kandidat; warna: 'penatua' | 'diaken'; maks: number; unggul: boolean; trend?: TrendKandidat;
}) {
  const [naik, setNaik] = useState(false);
  const sebelumnya = useRef(k.suara);

  useEffect(() => {
    if (k.suara > sebelumnya.current) {
      setNaik(true);
      const t = setTimeout(() => setNaik(false), 1300);
      sebelumnya.current = k.suara;
      return () => clearTimeout(t);
    }
    sebelumnya.current = k.suara;
  }, [k.suara]);

  const nilaiDelta = trend ? Math.abs(trend.perubahanLead || trend.perubahanSuara) : 0;

  return (
    <div className={`baris-hero ${naik ? 'naik' : ''} ${unggul ? `unggul ${warna}` : ''}`}>
      <Avatar k={k} ukuran="besar" />
      <div className="hero-info">
        <div className="hero-nama-baris">
          <span className="nama" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {unggul && <UserCheck size={14} className={warna === 'penatua' ? 'teks-penatua' : 'teks-diaken'} />}
            <span>{k.nama}</span>
            {k.aklamasi && (
              <span className="chip-aklamasi" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Check size={10} /> aklamasi
              </span>
            )}
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {trend && !k.aklamasi && (
              <span
                className={`trend-indicator trend-${trend.arah}`}
                title={trend.keterangan}
                aria-label={trend.keterangan}
              >
                {trend.arah === 'naik' && <TrendingUp size={11} strokeWidth={2.5} className="trend-ikon" />}
                {trend.arah === 'turun' && <TrendingDown size={11} strokeWidth={2.5} className="trend-ikon" />}
                {trend.arah === 'tetap' && <Minus size={11} strokeWidth={2.5} className="trend-ikon" />}
                <span className="trend-val">
                  {trend.arah === 'naik' && `+${nilaiDelta > 0 ? nilaiDelta : 1}`}
                  {trend.arah === 'turun' && `-${nilaiDelta > 0 ? nilaiDelta : 1}`}
                  {trend.arah === 'tetap' && '0'}
                </span>
              </span>
            )}
            <span className="hero-angka">
              {k.aklamasi ? (
                <span className="chip-aklamasi" style={{ marginLeft: 0, display: 'inline-flex', alignItems: 'center' }}>
                  <Check size={12} />
                </span>
              ) : (
                <Odometer nilai={k.suara} />
              )}
            </span>
          </div>
        </div>
        <div className={`bar-mini bar-hero ${warna}`}>
          <div style={{ width: `${(k.suara / maks) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function SeksiHero({ judul, warna, kandidat, aktif, mapTrend }: {
  judul: string; warna: 'penatua' | 'diaken'; kandidat: Kandidat[]; aktif: boolean; mapTrend?: Map<string, TrendKandidat>;
}) {
  const maks = Math.max(...kandidat.map((k) => k.suara), 1);
  const adaSuara = kandidat.some((k) => k.suara > 0);
  return (
    <div className="hero-seksi">
      <div className={`label-jabatan ${warna}`}>
        {judul}
        {aktif && (
          <span className={`badge badge-${warna}`} style={{ padding: '2px 9px', fontSize: '.62rem' }}>
            <span className="titik" />berlangsung
          </span>
        )}
      </div>
      {kandidat.length === 0 ? (
        <div className="teks-kosong">Belum ada calon</div>
      ) : (
        kandidat.map((k, i) => (
          <BarisHero
            k={k}
            warna={warna}
            maks={maks}
            unggul={i === 0 && adaSuara}
            trend={mapTrend?.get(k.id)}
            key={k.id}
          />
        ))
      )}
    </div>
  );
}

function KartuNav({ kolom, tengah, onClick }: { kolom: Kolom; tengah: boolean; onClick: () => void }) {
  const selesai = kolom.tahap === 'selesai';
  const barisRingkas = (label: 'P' | 'D', warna: 'penatua' | 'diaken', daftar: Kandidat[]) => {
    const { menang, seri } = hasilAkhir(daftar);
    const unggul = daftar[0];
    return (
      <div className="nav-ringkas">
        <span className={`label-jabatan ${warna}`} style={{ marginBottom: 0 }}>{label}</span>
        {selesai && menang ? (
          <>
            <Avatar k={menang} ukuran="mini" />
            <span className="nav-unggul" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={11} className="cek-kecil" /> {menang.nama}
            </span>
          </>
        ) : selesai && seri.length ? (
          <span className="nav-unggul seri-teks">Seri (pemilihan ulang)</span>
        ) : (
          <span className="nav-unggul">{unggul ? `${unggul.nama} · ${unggul.suara}` : '-'}</span>
        )}
      </div>
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Pilih ${kolom.nama}`}
      className={`kartu-nav ${tengah ? 'tengah' : ''} ${selesai ? 'selesai' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="kartu-judul">
        <h4>{kolom.nama}</h4>
        <span className={`badge badge-${kolom.tahap}`} style={{ padding: '2px 8px', fontSize: '.58rem' }}>
          {(selesai || kolom.petugasAktif) && <span className="titik" />}
          {TAHAP_LABEL[kolom.tahap]}
        </span>
      </div>
      {barisRingkas('P', 'penatua', kolom.penatua)}
      {barisRingkas('D', 'diaken', kolom.diaken)}
      <div className="nav-total"><Odometer nilai={totalKolom(kolom)} /> suara</div>
    </div>
  );
}

function HalamanQuickCountContent() {
  const searchParams = useSearchParams();
  const targetKolomParam = searchParams.get('kolom') || searchParams.get('id');

  const [data, setData] = useState<DataQC | null>(null);
  const [mapTrend, setMapTrend] = useState<Map<string, TrendKandidat>>(new Map());
  const [gagal, setGagal] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [jeda, setJeda] = useState(false);
  const [kunci, setKunci] = useState(false);
  const [filterSelesai, setFilterSelesai] = useState(false);
  const [lebarWadah, setLebarWadah] = useState(0);
  const [lebarKartu, setLebarKartu] = useState(LEBAR_NAV_BAWAAN);
  const relNav = useRef<HTMLDivElement>(null);
  const sentuhX = useRef<number | null>(null);
  const sentuhNav = useRef<{ x: number; t: number } | null>(null);
  const riwayatRef = useRef<Map<string, { suara: number; lead: number }>>(new Map());

  useEffect(() => {
    let hidup = true;
    async function muat() {
      try {
        const res = await fetch('/api/quickcount', { cache: 'no-store' });
        const json = await res.json();
        if (hidup && !json.error) {
          const trendBaru = hitungTrendSemuaKolom(json.kolom, riwayatRef);
          setMapTrend(trendBaru);
          setData(json);
          setGagal(false);
        }
      } catch {
        if (hidup) setGagal(true);
      }
    }
    muat();
    const timer = setInterval(muat, REFRESH_MS);
    return () => { hidup = false; clearInterval(timer); };
  }, []);

  // Kunci otomatis ke kolom tertentu jika ada query param ?kolom=X
  useEffect(() => {
    if (data && targetKolomParam) {
      const idxSemua = data.kolom.findIndex((k) => String(k.id) === targetKolomParam);
      if (idxSemua !== -1) {
        setFilterSelesai(false);
        setAktif(idxSemua);
        setKunci(true);
      }
    }
  }, [data, targetKolomParam]);

  const selesaiList = data
    ? data.kolom.filter((k) => k.tahap === 'selesai' && (k.penatua.length || k.diaken.length))
    : [];
  const daftarTampil = filterSelesai && selesaiList.length > 0 ? selesaiList : (data?.kolom ?? []);
  const jumlah = daftarTampil.length;

  // Ukur lebar wadah nav dan lebar kartu (berubah di layar sempit) untuk
  // memusatkan kartu aktif. Diukur ulang saat data pertama tiba dan saat resize.
  useLayoutEffect(() => {
    function ukur() {
      if (relNav.current) {
        setLebarWadah(relNav.current.clientWidth);
        const kartu = relNav.current.querySelector<HTMLElement>('.kartu-nav');
        if (kartu) setLebarKartu(kartu.offsetWidth);
      }
    }
    ukur();
    window.addEventListener('resize', ukur);
    return () => window.removeEventListener('resize', ukur);
  }, [jumlah]);

  const geser = useCallback((arah: 1 | -1) => {
    if (!jumlah) return;
    setAktif((a) => (a + arah + jumlah) % jumlah);
  }, [jumlah]);

  // Navigasi manual (klik kartu/panah/titik) mengunci carousel ke pilihan itu
  const pilih = useCallback((i: number) => {
    setAktif(i);
    setKunci(true);
  }, []);

  const geserManual = useCallback((arah: 1 | -1) => {
    geser(arah);
    setKunci(true);
  }, [geser]);

  // Geser otomatis (berhenti saat kursor di area carousel atau saat terkunci)
  useEffect(() => {
    if (jeda || kunci || jumlah === 0) return;
    const timer = setInterval(() => geser(1), GESER_OTOMATIS_MS);
    return () => clearInterval(timer);
  }, [jeda, kunci, jumlah, geser]);

  const kolomAktif = daftarTampil[Math.min(aktif, Math.max(0, jumlah - 1))];

  // Posisi track: kartu aktif selalu di tengah wadah (center mode)
  const langkah = lebarKartu + JARAK_NAV;
  const offset = lebarWadah / 2 - (aktif * langkah + lebarKartu / 2);

  // Geser dengan usapan jari (mobile)
  function sentuhMulai(e: React.TouchEvent) {
    sentuhX.current = e.touches[0].clientX;
  }
  function sentuhSelesai(e: React.TouchEvent) {
    if (sentuhX.current === null) return;
    const dx = e.changedTouches[0].clientX - sentuhX.current;
    sentuhX.current = null;
    if (Math.abs(dx) > 48) geserManual(dx < 0 ? 1 : -1);
  }

  // Usapan pada strip kartu kecil: mendukung flick (usapan cepat atau panjang)
  // melompati beberapa kartu sekaligus sesuai jarak dan kecepatannya
  function navMulai(e: React.TouchEvent) {
    sentuhNav.current = { x: e.touches[0].clientX, t: Date.now() };
  }
  function navSelesai(e: React.TouchEvent) {
    if (!sentuhNav.current || !jumlah) return;
    const dx = e.changedTouches[0].clientX - sentuhNav.current.x;
    const dt = Math.max(1, Date.now() - sentuhNav.current.t);
    sentuhNav.current = null;
    if (Math.abs(dx) < 40) return;

    const kecepatan = Math.abs(dx) / dt; // px per milidetik
    let lompat = Math.max(1, Math.round(Math.abs(dx) / langkah));
    if (kecepatan > 0.9) lompat += 2;
    else if (kecepatan > 0.5) lompat += 1;
    lompat = Math.min(lompat, 6);

    const arah = dx < 0 ? 1 : -1;
    setAktif((a) => (((a + arah * lompat) % jumlah) + jumlah) % jumlah);
    setKunci(true);
  }

  return (
    <>
      <header className="header-publik">
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Vote size={26} className="teks-penatua" />
          <span>Quick Count Pemilihan Penatua &amp; Diaken</span>
        </h1>
        <div className="sub">
          <span className="titik-live" />
          Hasil sementara &middot; diperbarui otomatis
          {data && <> &middot; {data.waktu}</>}
          {gagal && <span style={{ color: 'var(--merah)' }}> &middot; koneksi terputus, mencoba lagi…</span>}
        </div>
        <div className="statistik">
          <div
            className="stat"
            role={data && data.kolomSelesai > 0 ? 'button' : undefined}
            tabIndex={data && data.kolomSelesai > 0 ? 0 : undefined}
            aria-pressed={data && data.kolomSelesai > 0 ? filterSelesai : undefined}
            style={{ cursor: data && data.kolomSelesai > 0 ? 'pointer' : 'default' }}
            onClick={() => {
              if (data && data.kolomSelesai > 0) {
                setFilterSelesai((v) => !v);
                setAktif(0);
              }
            }}
            onKeyDown={(e) => {
              if (data && data.kolomSelesai > 0 && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setFilterSelesai((v) => !v);
                setAktif(0);
              }
            }}
            title={data && data.kolomSelesai > 0 ? (filterSelesai ? 'Tampilkan semua kolom' : 'Tampilkan khusus kolom terpilih') : undefined}
          >
            <div className="angka" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <CheckCircle2 size={20} className="teks-selesai" />
              <span>{data ? `${data.kolomSelesai}/${data.kolom.length}` : '-'}</span>
            </div>
            <div className="ket">
              Kolom Selesai {data && data.kolomSelesai > 0 && <span style={{ fontSize: '.68rem', color: 'var(--biru)' }}>{filterSelesai ? '(aktif)' : '(filter)'}</span>}
            </div>
          </div>
          <div className="stat">
            <div className="angka">
              {data ? (
                <Odometer nilai={data.totalPemilihMemilih !== undefined ? data.totalPemilihMemilih : data.totalSuara} />
              ) : (
                0
              )}
            </div>
            <div className="ket">
              {data && data.totalDpt && data.totalDpt > 0
                ? `Pemilih (${data.persenPartisipasi ?? '0'}% DPT)`
                : 'Pemilih Memilih'}
            </div>
          </div>
          <div className="stat">
            <div className="angka">{data ? <Odometer nilai={data.totalSuara} /> : 0}</div>
            <div className="ket">Akumulasi Suara Sah</div>
          </div>
        </div>
      </header>

      <main className="wadah" onMouseEnter={() => setJeda(true)} onMouseLeave={() => setJeda(false)}>
        {!data || !kolomAktif ? (
          <p style={{ textAlign: 'center', color: 'var(--samar)' }}>Memuat data…</p>
        ) : (
          <>
            {selesaiList.length > 0 && selesaiList.length < (data?.kolom.length ?? 0) && (
              <div className="filter-tab-wrap">
                <div className="filter-tab-box" role="tablist" aria-label="Pilihan tampilan kolom">
                  <button
                    role="tab"
                    aria-selected={!filterSelesai}
                    className={`filter-tab-btn ${!filterSelesai ? 'aktif' : ''}`}
                    onClick={() => { setFilterSelesai(false); setAktif(0); }}
                  >
                    <span>Semua Kolom</span>
                    <span className="filter-tab-badge">{data?.kolom.length ?? 0}</span>
                  </button>
                  <button
                    role="tab"
                    aria-selected={filterSelesai}
                    className={`filter-tab-btn terpilih-tab ${filterSelesai ? 'aktif' : ''}`}
                    onClick={() => { setFilterSelesai(true); setAktif(0); }}
                  >
                    <CheckCircle2 size={13} className="teks-selesai" />
                    <span>Khusus Terpilih</span>
                    <span className="filter-tab-badge">{selesaiList.length}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="hero-wrap" onTouchStart={sentuhMulai} onTouchEnd={sentuhSelesai}>
              <button className="panah panah-kiri" onClick={() => geserManual(-1)} aria-label="Kolom sebelumnya">
                <ChevronLeft size={22} />
              </button>
              <div className={`hero ${kolomAktif.tahap === 'selesai' ? 'hero-selesai' : ''}`} key={kolomAktif.id}>
                <div className="hero-kepala">
                  <div>
                    {kolomAktif.tahap === 'selesai' && (
                      <div className="hero-selesai-status">
                        <span className="badge badge-selesai" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <CheckCircle2 size={13} className="teks-selesai" /> Penetapan Hasil Terpilih
                        </span>
                        <span className="hero-selesai-tag">Penghitungan Selesai</span>
                      </div>
                    )}
                    <h2 className="hero-judul">{kolomAktif.nama}</h2>
                    {kolomAktif.tahap !== 'selesai' && (
                      <span className={`badge badge-${kolomAktif.tahap}`}>
                        {kolomAktif.petugasAktif && <span className="titik" />}
                        {TAHAP_LABEL[kolomAktif.tahap]}
                      </span>
                    )}
                    <span className="hero-total">
                      {kolomAktif.jumlahPemilih && kolomAktif.jumlahPemilih > 0 ? (
                        <>
                          <strong>{kolomAktif.pemilihMemilih ?? Math.max(kolomAktif.penatua.reduce((a, c) => a + c.suara, 0), kolomAktif.diaken.reduce((a, c) => a + c.suara, 0))}</strong> dari <strong>{kolomAktif.jumlahPemilih}</strong> DPT telah memilih ({(((kolomAktif.pemilihMemilih ?? Math.max(kolomAktif.penatua.reduce((a, c) => a + c.suara, 0), kolomAktif.diaken.reduce((a, c) => a + c.suara, 0))) / kolomAktif.jumlahPemilih) * 100).toFixed(1)}%)
                          <span style={{ opacity: 0.6, margin: '0 6px' }}>·</span>
                          <Odometer nilai={totalKolom(kolomAktif)} /> akumulasi suara
                        </>
                      ) : (
                        <>
                          <Odometer nilai={totalKolom(kolomAktif)} /> akumulasi suara
                        </>
                      )}
                      {kolomAktif.tahap === 'selesai' && ' · Berita acara telah disahkan'}
                    </span>
                  </div>
                  <div className="hero-hitung">
                    {String(aktif + 1).padStart(2, '0')}<span>/{jumlah}</span>
                  </div>
                </div>

                {kolomAktif.tahap === 'selesai' ? (
                  <div className="hero-grid-terpilih">
                    <SeksiTerpilihUtuh
                      judul="Penatua Terpilih"
                      warna="penatua"
                      kandidat={kolomAktif.penatua}
                    />
                    <SeksiTerpilihUtuh
                      judul="Diaken Terpilih"
                      warna="diaken"
                      kandidat={kolomAktif.diaken}
                    />
                  </div>
                ) : (
                  <div className="hero-grid">
                    <SeksiHero judul="Penatua" warna="penatua" kandidat={kolomAktif.penatua}
                      aktif={kolomAktif.tahap === 'penatua' && kolomAktif.petugasAktif}
                      mapTrend={mapTrend} />
                    <SeksiHero judul="Diaken" warna="diaken" kandidat={kolomAktif.diaken}
                      aktif={kolomAktif.tahap === 'diaken' && kolomAktif.petugasAktif}
                      mapTrend={mapTrend} />
                  </div>
                )}
              </div>
              <button className="panah panah-kanan" onClick={() => geserManual(1)} aria-label="Kolom berikutnya">
                <ChevronRight size={22} />
              </button>
            </div>

            <div className="nav-wrap" ref={relNav} onTouchStart={navMulai} onTouchEnd={navSelesai}>
              <div className="nav-track" style={{ transform: `translateX(${offset}px)` }}>
                {daftarTampil.map((k, i) => (
                  <KartuNav kolom={k} tengah={i === aktif} onClick={() => pilih(i)} key={k.id} />
                ))}
              </div>
            </div>

            <div className="dots">
              <button className="panah-dots" onClick={() => geserManual(-1)} aria-label="Kolom sebelumnya">
                <ChevronLeft size={14} />
              </button>
              {daftarTampil.map((k, i) => (
                <button
                  key={k.id}
                  className={`dot ${i === aktif ? 'aktif' : ''}`}
                  onClick={() => pilih(i)}
                  aria-label={k.nama}
                  title={k.nama}
                />
              ))}
              <button className="panah-dots" onClick={() => geserManual(1)} aria-label="Kolom berikutnya">
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                className={`btn-putar ${kunci ? 'terkunci' : ''}`}
                onClick={() => setKunci((v) => !v)}
                aria-label={kunci ? 'Lanjutkan putar otomatis' : 'Kunci di kolom ini'}
                title={kunci
                  ? `Terkunci di ${kolomAktif.nama}: klik untuk lanjut putar otomatis`
                  : `Putar otomatis aktif: klik untuk mengunci di ${kolomAktif.nama}`}
              >
                {kunci ? <Lock size={16} /> : jeda ? <Play size={16} /> : <Pause size={16} />}
              </button>
            </div>
          </>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: 16, color: 'var(--samar)', fontSize: '.8rem', borderTop: '1px solid var(--panel)' }}>
        Hasil bersifat sementara hingga penghitungan resmi selesai &middot; <a href="/login" style={{ color: 'var(--samar)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Login petugas <ExternalLink size={12} /></a>
      </footer>
    </>
  );
}

export default function HalamanQuickCount() {
  return (
    <Suspense fallback={<div className="layar-muat"><div className="roda-muat" /><p>Memuat Quick Count...</p></div>}>
      <HalamanQuickCountContent />
    </Suspense>
  );
}
