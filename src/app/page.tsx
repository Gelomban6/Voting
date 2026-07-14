'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const REFRESH_MS = 4000;
const GESER_OTOMATIS_MS = 4000; // kecepatan putar carousel hasil voting
const LEBAR_NAV_BAWAAN = 216; // lebar kartu nav sebelum terukur
const JARAK_NAV = 14;         // jarak antar kartu nav (selaras dengan CSS)

type Tahap = 'penatua' | 'diaken' | 'selesai';
interface Kandidat { id: string; nama: string; suara: number; aklamasi?: boolean; foto: string | null }
interface Kolom { id: number; nama: string; tahap: Tahap; petugasAktif: boolean; penatua: Kandidat[]; diaken: Kandidat[] }
interface DataQC { kolom: Kolom[]; totalSuara: number; kolomSelesai: number; waktu: string }

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

// Penentuan hasil: pemenang tunggal, atau seri (perlu pemilihan ulang).
// Selalu dihitung dari data terkini — bila kolom dibuka kembali untuk
// pemilihan ulang, tampilan terpilih otomatis mengikuti hasil baru.
function hasilAkhir(kandidat: Kandidat[]): { menang: Kandidat | null; seri: Kandidat[] } {
  if (!kandidat.length) return { menang: null, seri: [] };
  const maks = Math.max(...kandidat.map((k) => k.suara));
  if (maks <= 0) return { menang: null, seri: [] };
  const teratas = kandidat.filter((k) => k.suara === maks);
  if (teratas.length === 1) return { menang: teratas[0], seri: [] };
  return { menang: null, seri: teratas };
}

// ===== Satu sisi (penatua/diaken) dalam panel terpilih =====
function SisiTerpilih({ label, kandidat }: { label: string; kandidat: Kandidat[] }) {
  const { menang, seri } = hasilAkhir(kandidat);
  return (
    <div className={`terpilih-sisi ${seri.length ? 'seri' : ''}`}>
      <div className="terpilih-label">{label}</div>
      {menang ? (
        <>
          <span className="avatar-cek">
            <Avatar k={menang} ukuran="jumbo" />
            <span className="cek-badge">✓</span>
          </span>
          <div className="terpilih-nama">{menang.nama}</div>
          {menang.aklamasi ? (
            <div className="terpilih-suara label-aklamasi">Terpilih secara aklamasi</div>
          ) : (
            <div className="terpilih-suara"><Odometer nilai={menang.suara} /> suara</div>
          )}
        </>
      ) : seri.length ? (
        <>
          <div className="terpilih-seri-avatar">
            {seri.slice(0, 3).map((k) => <Avatar k={k} ukuran="besar" key={k.id} />)}
          </div>
          <div className="terpilih-nama">{seri.map((k) => k.nama).join(' & ')}</div>
          <div className="terpilih-suara seri-ket">Seri · {seri[0].suara} suara — menunggu pemilihan ulang</div>
        </>
      ) : (
        <div className="teks-kosong">Belum ada suara</div>
      )}
    </div>
  );
}

// ===== Kartu calon terpilih — berdiri sendiri, terpisah dari hasil voting =====
function PanelTerpilih({ kolom }: { kolom: Kolom }) {
  return (
    <div className="panel-terpilih">
      <div className="terpilih-judul">
        <span className="cek-kecil">✓</span> Terpilih &mdash; {kolom.nama}
      </div>
      <div className="terpilih-isi">
        <SisiTerpilih label="Penatua" kandidat={kolom.penatua} />
        <div className="terpilih-pisah" />
        <SisiTerpilih label="Diaken" kandidat={kolom.diaken} />
      </div>
    </div>
  );
}

// ===== Carousel tersendiri untuk kolom-kolom yang sudah selesai =====
function CarouselTerpilih({ daftar }: { daftar: Kolom[] }) {
  const [indeks, setIndeks] = useState(0);
  const [jeda, setJeda] = useState(false);
  const sentuhX = useRef<number | null>(null);

  const aktif = Math.min(indeks, daftar.length - 1);

  useEffect(() => {
    if (jeda || daftar.length < 2) return;
    const timer = setInterval(() => setIndeks((i) => (i + 1) % daftar.length), 6000);
    return () => clearInterval(timer);
  }, [jeda, daftar.length]);

  function geser(arah: 1 | -1) {
    setIndeks((aktif + arah + daftar.length) % daftar.length);
  }

  const kolom = daftar[aktif];
  return (
    <div
      className="terpilih-carousel"
      onMouseEnter={() => setJeda(true)}
      onMouseLeave={() => setJeda(false)}
      onTouchStart={(e) => { sentuhX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (sentuhX.current === null) return;
        const dx = e.changedTouches[0].clientX - sentuhX.current;
        sentuhX.current = null;
        if (Math.abs(dx) > 48) geser(dx < 0 ? 1 : -1);
      }}
    >
      {daftar.length > 1 && (
        <>
          <button className="panah panah-mini panah-kiri" onClick={() => geser(-1)} aria-label="Terpilih sebelumnya">‹</button>
          <button className="panah panah-mini panah-kanan" onClick={() => geser(1)} aria-label="Terpilih berikutnya">›</button>
        </>
      )}
      <PanelTerpilih kolom={kolom} key={kolom.id} />
      {daftar.length > 1 && (
        <div className="dots dots-terpilih">
          <button className="panah-dots" onClick={() => geser(-1)} aria-label="Terpilih sebelumnya">‹</button>
          {daftar.map((k, i) => (
            <button
              key={k.id}
              className={`dot ${i === aktif ? 'aktif' : ''}`}
              onClick={() => setIndeks(i)}
              aria-label={k.nama}
              title={k.nama}
            />
          ))}
          <button className="panah-dots" onClick={() => geser(1)} aria-label="Terpilih berikutnya">›</button>
        </div>
      )}
    </div>
  );
}

// ===== Angka bergulir ala odometer: tiap digit menggulung vertikal saat berubah =====
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

// ===== Baris kandidat di hero, berkilau saat suaranya bertambah =====
function BarisHero({ k, warna, maks, unggul }: {
  k: Kandidat; warna: 'penatua' | 'diaken'; maks: number; unggul: boolean;
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

  return (
    <div className={`baris-hero ${naik ? 'naik' : ''} ${unggul ? `unggul ${warna}` : ''}`}>
      <Avatar k={k} ukuran="besar" />
      <div className="hero-info">
        <div className="hero-nama-baris">
          <span className="nama">
            {unggul && <span className="tanda-unggul" />}{k.nama}
            {k.aklamasi && <span className="chip-aklamasi">aklamasi</span>}
          </span>
          <span className="hero-angka">
            {k.aklamasi ? <span className="chip-aklamasi" style={{ marginLeft: 0 }}>✓</span> : <Odometer nilai={k.suara} />}
          </span>
        </div>
        <div className={`bar-mini bar-hero ${warna}`}>
          <div style={{ width: `${(k.suara / maks) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// ===== Seksi jabatan di dalam hero =====
function SeksiHero({ judul, warna, kandidat, aktif }: {
  judul: string; warna: 'penatua' | 'diaken'; kandidat: Kandidat[]; aktif: boolean;
}) {
  const maks = Math.max(...kandidat.map((k) => k.suara), 1);
  const adaSuara = kandidat.some((k) => k.suara > 0);
  return (
    <div className="hero-seksi">
      <div className={`label-jabatan ${warna}`}>
        {judul}
        {aktif && <span className={`badge badge-${warna}`} style={{ padding: '2px 9px', fontSize: '.62rem' }}><span className="titik" />berlangsung</span>}
      </div>
      {kandidat.length === 0 ? (
        <div className="teks-kosong">Belum ada calon</div>
      ) : (
        kandidat.map((k, i) => (
          <BarisHero k={k} warna={warna} maks={maks} unggul={i === 0 && adaSuara} key={k.id} />
        ))
      )}
    </div>
  );
}

// ===== Kartu kecil pada strip navigasi =====
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
            <span className="nav-unggul"><span className="cek-kecil">✓</span> {menang.nama}</span>
          </>
        ) : selesai && seri.length ? (
          <span className="nav-unggul seri-teks">Seri — pemilihan ulang</span>
        ) : (
          <span className="nav-unggul">{unggul ? `${unggul.nama} · ${unggul.suara}` : '—'}</span>
        )}
      </div>
    );
  };

  return (
    <div className={`kartu-nav ${tengah ? 'tengah' : ''} ${selesai ? 'selesai' : ''}`} onClick={onClick}>
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

export default function HalamanQuickCount() {
  const [data, setData] = useState<DataQC | null>(null);
  const [gagal, setGagal] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [jeda, setJeda] = useState(false);
  const [kunci, setKunci] = useState(false); // terkunci ke kartu pilihan pengguna
  const [lebarWadah, setLebarWadah] = useState(0);
  const [lebarKartu, setLebarKartu] = useState(LEBAR_NAV_BAWAAN);
  const relNav = useRef<HTMLDivElement>(null);
  const sentuhX = useRef<number | null>(null);

  useEffect(() => {
    let hidup = true;
    async function muat() {
      try {
        const res = await fetch('/api/quickcount', { cache: 'no-store' });
        const json = await res.json();
        if (hidup && !json.error) {
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

  const jumlah = data?.kolom.length ?? 0;

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

  const kolomAktif = data?.kolom[Math.min(aktif, jumlah - 1)];

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

  return (
    <>
      <header className="header-publik">
        <h1>Quick Count Pemilihan Penatua &amp; Diaken</h1>
        <div className="sub">
          <span className="titik-live" />
          Hasil sementara &middot; diperbarui otomatis
          {data && <> &middot; {data.waktu}</>}
          {gagal && <span style={{ color: 'var(--merah)' }}> &middot; koneksi terputus, mencoba lagi…</span>}
        </div>
        <div className="statistik">
          <div className="stat">
            <div className="angka">{data ? `${data.kolomSelesai}/${jumlah}` : '–'}</div>
            <div className="ket">Kolom Selesai</div>
          </div>
          <div className="stat">
            <div className="angka">{data ? <Odometer nilai={data.totalSuara} /> : '–'}</div>
            <div className="ket">Total Suara</div>
          </div>
        </div>
      </header>

      <main className="wadah" onMouseEnter={() => setJeda(true)} onMouseLeave={() => setJeda(false)}>
        {!data || !kolomAktif ? (
          <p style={{ textAlign: 'center', color: 'var(--samar)' }}>Memuat data…</p>
        ) : (
          <>
            {/* ===== Carousel terpilih: kolom yang sudah selesai, paling atas ===== */}
            {(() => {
              const selesaiList = data.kolom.filter(
                (k) => k.tahap === 'selesai' && (k.penatua.length || k.diaken.length)
              );
              return selesaiList.length > 0 && <CarouselTerpilih daftar={selesaiList} />;
            })()}

            {/* ===== Hero: kolom yang sedang aktif ===== */}
            <div className="hero-wrap" onTouchStart={sentuhMulai} onTouchEnd={sentuhSelesai}>
              <button className="panah panah-kiri" onClick={() => geserManual(-1)} aria-label="Kolom sebelumnya">‹</button>
              <div className="hero" key={kolomAktif.id}>
                <div className="hero-kepala">
                  <div>
                    <h2 className="hero-judul">{kolomAktif.nama}</h2>
                    <span className={`badge badge-${kolomAktif.tahap}`}>
                      {(kolomAktif.tahap === 'selesai' || kolomAktif.petugasAktif) && <span className="titik" />}
                      {TAHAP_LABEL[kolomAktif.tahap]}
                    </span>
                    <span className="hero-total"><Odometer nilai={totalKolom(kolomAktif)} /> suara masuk</span>
                  </div>
                  <div className="hero-hitung">
                    {String(aktif + 1).padStart(2, '0')}<span>/{jumlah}</span>
                  </div>
                </div>
                <div className="hero-grid">
                  {/* "berlangsung" hanya menyala bila petugas kolom sedang login/aktif */}
                  <SeksiHero judul="Penatua" warna="penatua" kandidat={kolomAktif.penatua}
                    aktif={kolomAktif.tahap === 'penatua' && kolomAktif.petugasAktif} />
                  <SeksiHero judul="Diaken" warna="diaken" kandidat={kolomAktif.diaken}
                    aktif={kolomAktif.tahap === 'diaken' && kolomAktif.petugasAktif} />
                </div>
              </div>
              <button className="panah panah-kanan" onClick={() => geserManual(1)} aria-label="Kolom berikutnya">›</button>
            </div>

            {/* ===== Strip navigasi center-mode ===== */}
            <div className="nav-wrap" ref={relNav} onTouchStart={sentuhMulai} onTouchEnd={sentuhSelesai}>
              <div className="nav-track" style={{ transform: `translateX(${offset}px)` }}>
                {data.kolom.map((k, i) => (
                  <KartuNav kolom={k} tengah={i === aktif} onClick={() => pilih(i)} key={k.id} />
                ))}
              </div>
            </div>

            <div className="dots">
              <button className="panah-dots" onClick={() => geserManual(-1)} aria-label="Kolom sebelumnya">‹</button>
              {data.kolom.map((k, i) => (
                <button
                  key={k.id}
                  className={`dot ${i === aktif ? 'aktif' : ''}`}
                  onClick={() => pilih(i)}
                  aria-label={k.nama}
                  title={k.nama}
                />
              ))}
              <button className="panah-dots" onClick={() => geserManual(1)} aria-label="Kolom berikutnya">›</button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                className={`btn-putar ${kunci ? 'terkunci' : ''}`}
                onClick={() => setKunci((v) => !v)}
                aria-label={kunci ? 'Lanjutkan putar otomatis' : 'Kunci di kolom ini'}
                title={kunci
                  ? `Terkunci di ${kolomAktif.nama} — klik untuk lanjut putar otomatis`
                  : `Putar otomatis aktif — klik untuk mengunci di ${kolomAktif.nama}`}
              >
                {kunci ? '🔒' : '⏸'}
              </button>
            </div>
          </>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: 16, color: 'var(--samar)', fontSize: '.8rem', borderTop: '1px solid var(--panel)' }}>
        Hasil bersifat sementara hingga penghitungan resmi selesai &middot; <a href="/login" style={{ color: 'var(--samar)' }}>Login petugas</a>
      </footer>
    </>
  );
}
