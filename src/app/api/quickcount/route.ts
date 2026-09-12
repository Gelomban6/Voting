import { NextResponse } from 'next/server';
import { koleksiKolom, koleksiKandidat, kandidatKeJson, KandidatDoc } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kolomRows = await (await koleksiKolom()).find().sort({ _id: 1 }).toArray();
    const kandidatRows = await (await koleksiKandidat())
      .find({}, { projection: { foto: 0 } })
      .sort({ suara: -1, nama: 1 })
      .toArray();

    const perKolom = new Map<number, { penatua: KandidatDoc[]; diaken: KandidatDoc[] }>();
    for (const k of kolomRows) perKolom.set(k._id, { penatua: [], diaken: [] });
    for (const c of kandidatRows) {
      perKolom.get(c.kolomId)?.[c.jabatan].push(c);
    }

    let totalSuaraAkumulasi = 0;
    let totalDpt = 0;
    let totalPemilihMemilih = 0;

    // Petugas dianggap aktif bila heartbeat terakhirnya belum lewat 90 detik
    const batasAktif = Date.now() - 90_000;

    const data = kolomRows.map((k) => {
      const penatuaList = perKolom.get(k._id)!.penatua;
      const diakenList = perKolom.get(k._id)!.diaken;
      const suaraPenatua = penatuaList.reduce((acc, c) => acc + c.suara, 0);
      const suaraDiaken = diakenList.reduce((acc, c) => acc + c.suara, 0);

      // Jumlah pemilih unik kolom yang telah memberikan suara
      const pemilihMemilih = k.tahap === 'penatua' ? suaraPenatua : Math.max(suaraPenatua, suaraDiaken);
      const dptKolom = k.jumlahPemilih ?? 0;

      totalSuaraAkumulasi += (suaraPenatua + suaraDiaken);
      totalDpt += dptKolom;
      totalPemilihMemilih += pemilihMemilih;

      return {
        id: k._id,
        nama: k.nama,
        tahap: k.tahap,
        jumlahPemilih: dptKolom,
        pemilihMemilih,
        suaraPenatua,
        suaraDiaken,
        petugasAktif: !!k.petugasAktifPada && k.petugasAktifPada.getTime() > batasAktif,
        penatua: penatuaList.map(kandidatKeJson),
        diaken: diakenList.map(kandidatKeJson),
      };
    });

    return NextResponse.json({
      kolom: data,
      totalSuara: totalSuaraAkumulasi,
      totalDpt,
      totalPemilihMemilih,
      persenPartisipasi: totalDpt > 0 ? ((totalPemilihMemilih / totalDpt) * 100).toFixed(1) : '0',
      kolomSelesai: kolomRows.filter((k) => k.tahap === 'selesai').length,
      waktu: new Date().toLocaleTimeString('id-ID', { hour12: false }),
    });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}
