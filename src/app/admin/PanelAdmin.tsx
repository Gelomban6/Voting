'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ExternalLink,
  LogOut,
  Database,
  FileSpreadsheet,
  Copy,
  Download,
  Printer,
  Save,
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  Check,
  Layers,
  Users,
  QrCode,
  Share2,
} from 'lucide-react';
import { generateQRDataURL, unduhQRDataURL, dapatkanUrlPengamatKolom } from '@/lib/qr';

type Tahap = 'penatua' | 'diaken' | 'selesai';
interface Kolom {
  id: number;
  nama: string;
  kode: string;
  tahap: Tahap;
  jumlahKandidat: number;
  totalSuara: number;
}

interface RekapDetail {
  waktuCetak: string;
  totalSuaraGereja: number;
  kolomSelesai: number;
  totalKolom: number;
  data: Array<{
    id: number;
    nama: string;
    kode: string;
    tahap: Tahap;
    totalSuara: number;
    penatuaTerpilih: string;
    penatuaSuara: number;
    diakenTerpilih: string;
    diakenSuara: number;
    penatua: Array<{ nama: string; suara: number; aklamasi: boolean }>;
    diaken: Array<{ nama: string; suara: number; aklamasi: boolean }>;
  }>;
}

const TAHAP_LABEL: Record<Tahap, string> = {
  penatua: 'Voting Penatua',
  diaken: 'Voting Diaken',
  selesai: 'Selesai',
};

export default function PanelAdmin() {
  const router = useRouter();
  const [kolom, setKolom] = useState<Kolom[]>([]);
  const [dbStatus, setDbStatus] = useState<{ mode: 'mongodb' | 'memory'; info: string }>({
    mode: 'memory',
    info: 'Memuat...',
  });
  const [pesan, setPesan] = useState<{ jenis: 'sukses' | 'gagal'; teks: string } | null>(null);
  const [draft, setDraft] = useState<Record<number, { nama: string; kode: string }>>({});
  const [jumlahDraft, setJumlahDraft] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [rekapData, setRekapData] = useState<RekapDetail | null>(null);
  const [tampilCetak, setTampilCetak] = useState(false);

  const [modalQRKolom, setModalQRKolom] = useState<Kolom | null>(null);
  const [qrDataUrlSingle, setQrDataUrlSingle] = useState<string>('');
  const [modalSemuaQR, setModalSemuaQR] = useState(false);
  const [petaQRDataUrl, setPetaQRDataUrl] = useState<Record<number, string>>({});
  const [memuatQR, setMemuatQR] = useState(false);
  const [pesanTersalinId, setPesanTersalinId] = useState<number | null>(null);

  const [modalKonfirmasi, setModalKonfirmasi] = useState<{
    judul: string;
    pesan: string;
    aksiLabel: string;
    bahaya?: boolean;
    onKonfirmasi: () => Promise<void> | void;
  } | null>(null);

  const muat = useCallback(async () => {
    const res = await fetch('/api/admin/kolom', { cache: 'no-store' });
    if (res.status === 401) { router.push('/login'); return; }
    const json = await res.json();
    if (!json.error) {
      setKolom(json.kolom);
      if (json.dbStatus) setDbStatus(json.dbStatus);
      const d: Record<number, { nama: string; kode: string }> = {};
      for (const k of json.kolom as Kolom[]) d[k.id] = { nama: k.nama, kode: k.kode };
      setDraft(d);
      setJumlahDraft(String(json.kolom.length));
    }
  }, [router]);

  useEffect(() => { muat(); }, [muat]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (modalKonfirmasi) setModalKonfirmasi(null);
        else if (modalQRKolom) setModalQRKolom(null);
        else if (modalSemuaQR) setModalSemuaQR(false);
        else if (tampilCetak) setTampilCetak(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalKonfirmasi, modalQRKolom, modalSemuaQR, tampilCetak]);

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

  async function simpanKolom(id: number) {
    const d = draft[id];
    if (!d) return;
    if (await panggil('/api/admin/kolom', { id, nama: d.nama, kode: d.kode }, 'PATCH')) {
      tampilkan('sukses', `Kolom ${id} disimpan.`);
      muat();
    }
  }

  async function ubahTahap(id: number, tahap: Tahap) {
    if (await panggil('/api/admin/kolom', { id, tahap }, 'PATCH')) {
      tampilkan('sukses', `Tahap kolom ${id} diubah.`);
      muat();
    }
  }

  async function simpanJumlah() {
    const jumlah = Math.floor(Number(jumlahDraft));
    if (!Number.isFinite(jumlah) || jumlah < 1 || jumlah > 99) {
      tampilkan('gagal', 'Jumlah kolom harus antara 1 dan 99.');
      return;
    }
    if (jumlah < kolom.length) {
      const dihapus = kolom.filter((k) => k.id > jumlah);
      const adaData = dihapus.some((k) => k.jumlahKandidat > 0 || Number(k.totalSuara) > 0);
      const teks = adaData
        ? `Mengurangi ke ${jumlah} akan MENGHAPUS ${dihapus.length} kolom terakhir BESERTA calon dan suaranya. Lanjutkan?`
        : `Mengurangi ke ${jumlah} akan menghapus ${dihapus.length} kolom terakhir (belum berisi data). Lanjutkan?`;
      
      setModalKonfirmasi({
        judul: 'Kurangi Jumlah Kolom',
        pesan: teks,
        aksiLabel: 'Terapkan Pengurangan',
        bahaya: true,
        onKonfirmasi: async () => {
          if (await panggil('/api/admin/kolom', { jumlah }, 'PUT')) {
            tampilkan('sukses', `Jumlah kolom sekarang ${jumlah}.`);
            muat();
          }
        },
      });
      return;
    }

    if (await panggil('/api/admin/kolom', { jumlah }, 'PUT')) {
      tampilkan('sukses', `Jumlah kolom sekarang ${jumlah}.`);
      muat();
    }
  }

  function reset(jenis: 'suara' | 'semua') {
    const isSuara = jenis === 'suara';
    setModalKonfirmasi({
      judul: isSuara ? 'Nolkan Semua Suara' : 'Hapus Semua Calon & Suara',
      pesan: isSuara
        ? 'Nolkan SEMUA perolehan suara dan kembalikan seluruh kolom ke tahap Penatua? Daftar calon tetap tersimpan.'
        : 'HAPUS SEMUA calon beserta suaranya dan mulai dari awal? Tindakan ini PERMANEN dan tidak dapat dibatalkan.',
      aksiLabel: isSuara ? 'Nolkan Suara' : 'Hapus Bersih Semua Data',
      bahaya: true,
      onKonfirmasi: async () => {
        if (await panggil('/api/admin/reset', { jenis })) {
          tampilkan('sukses', 'Reset berhasil.');
          muat();
        }
      },
    });
  }

  function salinSemuaAkun() {
    if (!kolom.length) return;
    const teks = kolom
      .map((k) => `${k.nama} -> Kode Akses: ${k.kode}`)
      .join('\n');
    navigator.clipboard.writeText(teks);
    tampilkan('sukses', 'Daftar kode akses semua kolom berhasil disalin ke clipboard!');
  }

  async function bukaCetakBeritaAcara() {
    setSibuk(true);
    try {
      const res = await fetch('/api/admin/rekap');
      const json = await res.json();
      if (!res.ok) {
        tampilkan('gagal', json.error ?? 'Gagal memuat rekapitulasi');
        return;
      }
      setRekapData(json);
      setTampilCetak(true);
    } catch {
      tampilkan('gagal', 'Tidak dapat terhubung ke server');
    } finally {
      setSibuk(false);
    }
  }

  async function unduhCSV() {
    setSibuk(true);
    try {
      const res = await fetch('/api/admin/rekap');
      const json: RekapDetail = await res.json();
      if (!res.ok) {
        tampilkan('gagal', 'Gagal memuat data untuk diekspor');
        return;
      }

      let csv = '\uFEFF'; // UTF-8 BOM agar terbaca rapi di Microsoft Excel
      csv += 'No,Nama Kolom,Tahap,Total Suara Kolom,Penatua Terpilih,Suara Penatua,Diaken Terpilih,Suara Diaken\r\n';
      json.data.forEach((k, idx) => {
        const row = [
          idx + 1,
          `"${k.nama.replace(/"/g, '""')}"`,
          `"${TAHAP_LABEL[k.tahap]}"`,
          k.totalSuara,
          `"${k.penatuaTerpilih.replace(/"/g, '""')}"`,
          k.penatuaSuara,
          `"${k.diakenTerpilih.replace(/"/g, '""')}"`,
          k.diakenSuara,
        ];
        csv += row.join(',') + '\r\n';
      });

      csv += '\r\n\r\nDetail Rincian Seluruh Calon Per Kolom:\r\n';
      csv += 'Nama Kolom,Jabatan,Nama Calon,Perolehan Suara,Aklamasi\r\n';
      json.data.forEach((k) => {
        k.penatua.forEach((c) => {
          csv += `"${k.nama.replace(/"/g, '""')}",Penatua,"${c.nama.replace(/"/g, '""')}",${c.suara},${c.aklamasi ? 'Ya' : 'Tidak'}\r\n`;
        });
        k.diaken.forEach((c) => {
          csv += `"${k.nama.replace(/"/g, '""')}",Diaken,"${c.nama.replace(/"/g, '""')}",${c.suara},${c.aklamasi ? 'Ya' : 'Tidak'}\r\n`;
        });
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekapitulasi_Pemilihan_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      tampilkan('sukses', 'File CSV Rekapitulasi berhasil diunduh.');
    } catch {
      tampilkan('gagal', 'Gagal membuat file CSV');
    } finally {
      setSibuk(false);
    }
  }

  async function bukaModalQR(k: Kolom) {
    setModalQRKolom(k);
    setQrDataUrlSingle('');
    try {
      const url = dapatkanUrlPengamatKolom(k.id);
      const dataUrl = await generateQRDataURL(url, 320);
      setQrDataUrlSingle(dataUrl);
    } catch {
      tampilkan('gagal', 'Gagal menghasilkan QR Code untuk ' + k.nama);
    }
  }

  async function bukaModalSemuaQR() {
    setModalSemuaQR(true);
    setMemuatQR(true);
    try {
      const peta: Record<number, string> = {};
      for (const k of kolom) {
        const url = dapatkanUrlPengamatKolom(k.id);
        peta[k.id] = await generateQRDataURL(url, 260);
      }
      setPetaQRDataUrl(peta);
    } catch {
      tampilkan('gagal', 'Gagal menghasilkan beberapa QR Code');
    } finally {
      setMemuatQR(false);
    }
  }

  function salinTautanPengamat(id: number) {
    const url = dapatkanUrlPengamatKolom(id);
    navigator.clipboard.writeText(url);
    setPesanTersalinId(id);
    setTimeout(() => setPesanTersalinId(null), 2500);
  }

  function unduhKartuQR(id: number, nama: string, dataUrl: string) {
    unduhQRDataURL(dataUrl, `QR_Kolom_${id}_${nama.replace(/\s+/g, '_')}.png`);
  }

  async function keluar() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <>
      <nav className="nav-panel">
        <span className="merek" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ShieldCheck size={18} className="text-sky-400" />
          <span>Panel Admin</span>
        </span>
        <span
          className={`badge-db ${
            dbStatus.mode === 'mongodb' ? 'badge-db-mongo' : 'badge-db-memory'
          }`}
          title={dbStatus.info}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <Database size={12} />
          <span>{dbStatus.info}</span>
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

        {/* Panel Laporan & Ekspor */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                <FileSpreadsheet size={18} className="text-sky-400" />
                <span>Laporan &amp; Berita Acara Rekapitulasi</span>
              </h2>
              <p style={{ fontSize: '.82rem', color: 'var(--redup)' }}>
                Cetak Berita Acara resmi panitia atau unduh data perolehan suara dalam format Excel/CSV.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sekunder btn-kecil" onClick={bukaModalSemuaQR} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <QrCode size={13} className="text-sky-400" />
                <span>QR Code Semua Kolom</span>
              </button>
              <button className="btn btn-sekunder btn-kecil" onClick={salinSemuaAkun} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Copy size={13} />
                <span>Salin Akun Kolom</span>
              </button>
              <button className="btn btn-sekunder btn-kecil" onClick={unduhCSV} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Download size={13} />
                <span>Unduh CSV/Excel</span>
              </button>
              <button className="btn btn-hijau btn-kecil" onClick={bukaCetakBeritaAcara} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Printer size={13} />
                <span>Cetak Berita Acara</span>
              </button>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Layers size={18} className="text-amber-400" />
            <span>Jumlah Kolom</span>
          </h2>
          <p style={{ fontSize: '.82rem', color: 'var(--redup)', marginBottom: 14 }}>
            Menambah membuat kolom baru dengan kode bawaan. Mengurangi <strong>menghapus kolom
            bernomor terbesar beserta calon dan suaranya</strong> (lakukan sebelum acara dimulai).
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="number" min={1} max={99} className="input"
              aria-label="Jumlah total kolom"
              style={{ width: 110, textAlign: 'center', fontWeight: 700 }}
              value={jumlahDraft}
              onChange={(e) => setJumlahDraft(e.target.value)}
            />
            <span style={{ fontSize: '.85rem', color: 'var(--redup)' }}>kolom (saat ini {kolom.length})</span>
            <button className="btn" onClick={simpanJumlah} disabled={sibuk || Number(jumlahDraft) === kolom.length} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} />
              <span>Terapkan</span>
            </button>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Users size={18} className="text-sky-400" />
                <span>Kolom &amp; Kode Akses Petugas</span>
              </h2>
              <p style={{ fontSize: '.82rem', color: 'var(--redup)' }}>
                Bagikan kode akses ke petugas masing-masing kolom. Anda dapat mengubah nama kolom dan kode akses kapan saja.
              </p>
            </div>
          </div>
          <table className="tabel">
            <thead>
              <tr>
                <th>Nama Kolom</th>
                <th>Kode Akses</th>
                <th>Tahap</th>
                <th style={{ textAlign: 'center' }}>Calon</th>
                <th style={{ textAlign: 'center' }}>Suara</th>
                <th style={{ textAlign: 'center' }}>QR Pengamat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {kolom.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--samar)', fontSize: '.88rem' }}>
                    Belum ada kolom yang terdaftar. Atur jumlah kolom pada panel di atas untuk memulai.
                  </td>
                </tr>
              ) : (
                kolom.map((k) => (
                <tr key={k.id}>
                  <td style={{ minWidth: 130 }}>
                    <input className="input" style={{ padding: '6px 10px', fontSize: '.85rem' }}
                      aria-label={`Nama ${k.nama}`}
                      value={draft[k.id]?.nama ?? ''}
                      onChange={(e) => setDraft((p) => ({ ...p, [k.id]: { ...p[k.id], nama: e.target.value } }))} />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <input className="input" style={{ padding: '6px 10px', fontSize: '.85rem' }}
                      aria-label={`Kode akses ${k.nama}`}
                      value={draft[k.id]?.kode ?? ''}
                      onChange={(e) => setDraft((p) => ({ ...p, [k.id]: { ...p[k.id], kode: e.target.value } }))} />
                  </td>
                  <td>
                    <select className="input" style={{ padding: '6px 10px', fontSize: '.82rem', width: 'auto' }}
                      aria-label={`Tahap pemilihan ${k.nama}`}
                      value={k.tahap} onChange={(e) => ubahTahap(k.id, e.target.value as Tahap)}>
                      {(Object.keys(TAHAP_LABEL) as Tahap[]).map((t) => (
                        <option value={t} key={t}>{TAHAP_LABEL[t]}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>{k.jumlahKandidat}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{Number(k.totalSuara).toLocaleString('id-ID')}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-sekunder btn-kecil"
                      onClick={() => bukaModalQR(k)}
                      title={`Tampilkan QR Code untuk pemantauan ${k.nama}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <QrCode size={13} className="text-sky-400" />
                      <span>QR Code</span>
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-kecil" onClick={() => simpanKolom(k.id)} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Save size={12} />
                      <span>Simpan</span>
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2 style={{ fontSize: '1.05rem', marginBottom: 6, color: 'var(--merah)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlertTriangle size={18} />
            <span>Zona Berbahaya</span>
          </h2>
          <p style={{ fontSize: '.82rem', color: 'var(--redup)', marginBottom: 14 }}>
            Gunakan sebelum acara dimulai atau untuk gladi bersih.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-sekunder" onClick={() => reset('suara')} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={14} />
              <span>Nolkan Semua Suara</span>
            </button>
            <button className="btn btn-merah" onClick={() => reset('semua')} disabled={sibuk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} />
              <span>Hapus Semua Calon &amp; Suara</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog Konfirmasi */}
      {modalKonfirmasi && (
        <div className="modal-overlay" onClick={() => setModalKonfirmasi(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-judul" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {modalKonfirmasi.bahaya ? <AlertTriangle size={18} className="text-rose-400" /> : <ShieldCheck size={18} className="text-emerald-400" />}
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

      {/* Modal / Tampilan Cetak Berita Acara */}
      {tampilCetak && rekapData && (
        <div className="modal-overlay modal-cetak-aktif" onClick={() => setTampilCetak(false)}>
          <div
            className="modal-box wadah-cetak"
            style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto', background: '#fff', color: '#111' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kop-surat">
              <h1>BERITA ACARA REKAPITULASI HASIL PEMILIHAN</h1>
              <h1>PENATUA &amp; DIAKEN PERIODE PELAYANAN</h1>
              <p>Waktu Cetak: {rekapData.waktuCetak} · Total Suara Masuk: {rekapData.totalSuaraGereja.toLocaleString('id-ID')} suara</p>
            </div>

            <table className="tabel-cetak">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>No</th>
                  <th>Kolom</th>
                  <th>Status</th>
                  <th>Penatua Terpilih</th>
                  <th style={{ width: 65 }}>Suara</th>
                  <th>Diaken Terpilih</th>
                  <th style={{ width: 65 }}>Suara</th>
                  <th style={{ width: 75 }}>Total Suara</th>
                </tr>
              </thead>
              <tbody>
                {rekapData.data.map((k, i) => (
                  <tr key={k.id}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{k.nama}</td>
                    <td style={{ textAlign: 'center' }}>{k.tahap === 'selesai' ? 'Selesai' : 'Berlangsung'}</td>
                    <td>{k.penatuaTerpilih}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{k.penatuaSuara || '-'}</td>
                    <td>{k.diakenTerpilih}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{k.diakenSuara || '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{k.totalSuara}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tanda-tangan">
              <div className="ttd-box">
                <p>Ketua Panitia</p>
                <div className="ttd-garis">( ....................................... )</div>
              </div>
              <div className="ttd-box">
                <p>Sekretaris Panitia</p>
                <div className="ttd-garis">( ....................................... )</div>
              </div>
              <div className="ttd-box">
                <p>Saksi / Perwakilan</p>
                <div className="ttd-garis">( ....................................... )</div>
              </div>
            </div>

            <div className="modal-aksi" style={{ marginTop: 24, borderTop: '1px solid #ddd', paddingTop: 16 }}>
              <button type="button" className="btn btn-sekunder" onClick={() => setTampilCetak(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <X size={14} />
                <span>Tutup</span>
              </button>
              <button type="button" className="btn btn-hijau" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Printer size={14} />
                <span>Cetak Dokumen Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code Single Kolom */}
      {modalQRKolom && (
        <div className="modal-overlay" onClick={() => setModalQRKolom(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-judul" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <QrCode size={20} className="text-sky-400" />
              <span>QR Code Stasiun: {modalQRKolom.nama}</span>
            </div>
            <p className="modal-pesan" style={{ marginBottom: 16 }}>
              Pindai QR Code di bawah dengan kamera ponsel untuk memantau perolehan suara secara langsung (real-time) khusus stasiun <strong>{modalQRKolom.nama}</strong>.
            </p>

            <div className="kartu-qr-single">
              <div className="img-qr-wadah">
                {qrDataUrlSingle ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrlSingle} alt={`QR Code ${modalQRKolom.nama}`} />
                ) : (
                  <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--redup)' }}>
                    Menghasilkan QR Code...
                  </div>
                )}
              </div>
              <div className="tautan-qr-teks">
                {dapatkanUrlPengamatKolom(modalQRKolom.id)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-sekunder btn-kecil"
                  onClick={() => salinTautanPengamat(modalQRKolom.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Copy size={13} />
                  <span>{pesanTersalinId === modalQRKolom.id ? 'Tersalin!' : 'Salin Tautan'}</span>
                </button>
                {qrDataUrlSingle && (
                  <button
                    type="button"
                    className="btn btn-sekunder btn-kecil"
                    onClick={() => unduhKartuQR(modalQRKolom.id, modalQRKolom.nama, qrDataUrlSingle)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Download size={13} />
                    <span>Unduh PNG</span>
                  </button>
                )}
                <a
                  href={dapatkanUrlPengamatKolom(modalQRKolom.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sekunder btn-kecil"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                >
                  <ExternalLink size={13} />
                  <span>Buka Hasil</span>
                </a>
              </div>
            </div>

            <div className="modal-aksi" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setModalQRKolom(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code Seluruh Kolom (Print-Ready Sheets) */}
      {modalSemuaQR && (
        <div className="modal-overlay modal-cetak-aktif" onClick={() => setModalSemuaQR(false)}>
          <div
            className="modal-box modal-lebar"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Dialog (disembunyikan saat cetak) */}
            <div className="tidak-cetak" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <QrCode size={20} className="text-sky-400" />
                  <span>QR Code Pemantauan Seluruh Kolom ({kolom.length} Stasiun)</span>
                </h2>
                <p style={{ fontSize: '.84rem', color: 'var(--redup)', marginTop: 4 }}>
                  Cetak kartu QR ini untuk diletakkan di bilik/meja masing-masing kolom agar saksi dan jemaat dapat memantau perolehan suara secara real-time.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-hijau btn-kecil"
                  onClick={() => window.print()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={14} />
                  <span>Cetak Semua Kartu QR</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sekunder btn-kecil"
                  onClick={() => setModalSemuaQR(false)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {memuatQR ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--redup)' }}>
                <div className="roda-muat" style={{ margin: '0 auto 12px' }} />
                <span>Menghasilkan QR Code untuk {kolom.length} kolom...</span>
              </div>
            ) : (
              <div className="grid-kartu-qr wadah-cetak-qr">
                {kolom.map((k) => {
                  const dataUrl = petaQRDataUrl[k.id];
                  const url = dapatkanUrlPengamatKolom(k.id);
                  return (
                    <div key={k.id} className="kartu-qr-grid-item kartu-qr-print">
                      <h3>{k.nama}</h3>
                      <p className="instruksi-qr">
                        Pindai untuk memantau perolehan suara langsung (real-time)
                      </p>
                      <div className="img-qr-wadah">
                        {dataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={dataUrl} alt={`QR Code ${k.nama}`} />
                        ) : (
                          <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ...
                          </div>
                        )}
                      </div>
                      <div className="url-print tautan-qr-teks" style={{ fontSize: '.72rem', margin: '4px 0 10px' }}>
                        {url}
                      </div>
                      <div className="tidak-cetak" style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sekunder btn-kecil"
                          onClick={() => salinTautanPengamat(k.id)}
                          style={{ padding: '6px 10px', fontSize: '.76rem', minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        >
                          <Copy size={12} />
                          <span>{pesanTersalinId === k.id ? 'Tersalin' : 'Salin'}</span>
                        </button>
                        {dataUrl && (
                          <button
                            type="button"
                            className="btn btn-sekunder btn-kecil"
                            onClick={() => unduhKartuQR(k.id, k.nama, dataUrl)}
                            style={{ padding: '6px 10px', fontSize: '.76rem', minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <Download size={12} />
                            <span>PNG</span>
                          </button>
                        )}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sekunder btn-kecil"
                          style={{ padding: '6px 10px', fontSize: '.76rem', textDecoration: 'none', minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title={`Buka hasil ${k.nama}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modal-aksi tidak-cetak" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-sekunder"
                onClick={() => setModalSemuaQR(false)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-hijau"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={14} />
                <span>Cetak Semua Kartu QR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
