'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  // ==== Salin Daftar Akun Petugas ke Clipboard ====
  function salinSemuaAkun() {
    if (!kolom.length) return;
    const teks = kolom
      .map((k) => `${k.nama} -> Kode Akses: ${k.kode}`)
      .join('\n');
    navigator.clipboard.writeText(teks);
    tampilkan('sukses', 'Daftar kode akses semua kolom berhasil disalin ke clipboard!');
  }

  // ==== Muat Rekap Detail & Buka Modal Cetak ====
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

  // ==== Download File CSV / Excel ====
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

  async function keluar() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <>
      <nav className="nav-panel">
        <span className="merek">⚙️ Panel Admin</span>
        <span
          className={`badge-db ${
            dbStatus.mode === 'mongodb' ? 'badge-db-mongo' : 'badge-db-memory'
          }`}
          title={dbStatus.info}
        >
          ● {dbStatus.info}
        </span>
        <a href="/" target="_blank">Lihat Quick Count ↗</a>
        <span className="spasi" />
        <a href="#" onClick={(e) => { e.preventDefault(); keluar(); }}>Keluar</a>
      </nav>

      <div className="wadah-sempit">
        {pesan && <div className={`pesan pesan-${pesan.jenis}`}>{pesan.teks}</div>}

        {/* Panel Laporan & Ekspor */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', marginBottom: 4 }}>📊 Laporan &amp; Berita Acara Rekapitulasi</h2>
              <p style={{ fontSize: '.82rem', color: 'var(--redup)' }}>
                Cetak Berita Acara resmi panitia atau unduh data perolehan suara dalam format Excel/CSV.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sekunder btn-kecil" onClick={salinSemuaAkun} disabled={sibuk}>
                📋 Salin Akun Kolom
              </button>
              <button className="btn btn-sekunder btn-kecil" onClick={unduhCSV} disabled={sibuk}>
                📥 Unduh CSV/Excel
              </button>
              <button className="btn btn-hijau btn-kecil" onClick={bukaCetakBeritaAcara} disabled={sibuk}>
                🖨️ Cetak Berita Acara
              </button>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: 6 }}>Jumlah Kolom</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--redup)', marginBottom: 14 }}>
            Menambah membuat kolom baru dengan kode bawaan. Mengurangi <strong>menghapus kolom
            bernomor terbesar beserta calon dan suaranya</strong> — lakukan sebelum acara dimulai.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="number" min={1} max={99} className="input"
              style={{ width: 110, textAlign: 'center', fontWeight: 700 }}
              value={jumlahDraft}
              onChange={(e) => setJumlahDraft(e.target.value)}
            />
            <span style={{ fontSize: '.85rem', color: 'var(--redup)' }}>kolom (saat ini {kolom.length})</span>
            <button className="btn" onClick={simpanJumlah} disabled={sibuk || Number(jumlahDraft) === kolom.length}>
              Terapkan
            </button>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', marginBottom: 4 }}>Kolom &amp; Kode Akses Petugas</h2>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {kolom.map((k) => (
                <tr key={k.id}>
                  <td style={{ minWidth: 130 }}>
                    <input className="input" style={{ padding: '6px 10px', fontSize: '.85rem' }}
                      value={draft[k.id]?.nama ?? ''}
                      onChange={(e) => setDraft((p) => ({ ...p, [k.id]: { ...p[k.id], nama: e.target.value } }))} />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <input className="input" style={{ padding: '6px 10px', fontSize: '.85rem' }}
                      value={draft[k.id]?.kode ?? ''}
                      onChange={(e) => setDraft((p) => ({ ...p, [k.id]: { ...p[k.id], kode: e.target.value } }))} />
                  </td>
                  <td>
                    <select className="input" style={{ padding: '6px 10px', fontSize: '.82rem', width: 'auto' }}
                      value={k.tahap} onChange={(e) => ubahTahap(k.id, e.target.value as Tahap)}>
                      {(Object.keys(TAHAP_LABEL) as Tahap[]).map((t) => (
                        <option value={t} key={t}>{TAHAP_LABEL[t]}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>{k.jumlahKandidat}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{Number(k.totalSuara).toLocaleString('id-ID')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-kecil" onClick={() => simpanKolom(k.id)} disabled={sibuk}>Simpan</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2 style={{ fontSize: '1.05rem', marginBottom: 6, color: 'var(--merah)' }}>Zona Berbahaya</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--redup)', marginBottom: 14 }}>
            Gunakan sebelum acara dimulai atau untuk gladi bersih.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-sekunder" onClick={() => reset('suara')} disabled={sibuk}>
              Nolkan Semua Suara
            </button>
            <button className="btn btn-merah" onClick={() => reset('semua')} disabled={sibuk}>
              Hapus Semua Calon &amp; Suara
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog Konfirmasi */}
      {modalKonfirmasi && (
        <div className="modal-overlay" onClick={() => setModalKonfirmasi(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-judul">{modalKonfirmasi.judul}</div>
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
              >
                {modalKonfirmasi.aksiLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Tampilan Cetak Berita Acara */}
      {tampilCetak && rekapData && (
        <div className="modal-overlay" onClick={() => setTampilCetak(false)}>
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
              <button type="button" className="btn btn-sekunder" onClick={() => setTampilCetak(false)}>
                Tutup
              </button>
              <button type="button" className="btn btn-hijau" onClick={() => window.print()}>
                🖨️ Cetak Dokumen Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
