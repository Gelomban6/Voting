'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Tahap = 'penatua' | 'diaken' | 'selesai';
interface Kolom {
  id: number; nama: string; kode: string; tahap: Tahap;
  jumlahKandidat: number; totalSuara: number;
}

const TAHAP_LABEL: Record<Tahap, string> = {
  penatua: 'Voting Penatua',
  diaken: 'Voting Diaken',
  selesai: 'Selesai',
};

export default function PanelAdmin() {
  const router = useRouter();
  const [kolom, setKolom] = useState<Kolom[]>([]);
  const [pesan, setPesan] = useState<{ jenis: 'sukses' | 'gagal'; teks: string } | null>(null);
  const [draft, setDraft] = useState<Record<number, { nama: string; kode: string }>>({});
  const [jumlahDraft, setJumlahDraft] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const res = await fetch('/api/admin/kolom', { cache: 'no-store' });
    if (res.status === 401) { router.push('/login'); return; }
    const json = await res.json();
    if (!json.error) {
      setKolom(json.kolom);
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
      if (!confirm(teks)) return;
    }
    if (await panggil('/api/admin/kolom', { jumlah }, 'PUT')) {
      tampilkan('sukses', `Jumlah kolom sekarang ${jumlah}.`);
      muat();
    }
  }

  async function reset(jenis: 'suara' | 'semua') {
    const teks = jenis === 'suara'
      ? 'Nolkan SEMUA suara dan kembalikan semua kolom ke tahap Penatua? Daftar calon tetap tersimpan.'
      : 'HAPUS SEMUA calon beserta suaranya dan mulai dari awal? Tindakan ini tidak bisa dibatalkan.';
    if (!confirm(teks)) return;
    if (await panggil('/api/admin/reset', { jenis })) {
      tampilkan('sukses', 'Reset berhasil.');
      muat();
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
        <a href="/" target="_blank">Lihat Quick Count ↗</a>
        <span className="spasi" />
        <a href="#" onClick={(e) => { e.preventDefault(); keluar(); }}>Keluar</a>
      </nav>

      <div className="wadah-sempit">
        {pesan && <div className={`pesan pesan-${pesan.jenis}`}>{pesan.teks}</div>}

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
          <h2 style={{ fontSize: '1.05rem', marginBottom: 6 }}>Kolom &amp; Kode Akses Petugas</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--redup)', marginBottom: 14 }}>
            Bagikan kode akses ke petugas masing-masing kolom. Kode bawaan: <code>kolom1</code> … <code>kolom19</code> — sebaiknya diganti.
          </p>
          <table className="tabel">
            <thead>
              <tr>
                <th>Nama Kolom</th>
                <th>Kode Akses</th>
                <th>Tahap</th>
                <th>Calon</th>
                <th>Suara</th>
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
                  <td>
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
    </>
  );
}
