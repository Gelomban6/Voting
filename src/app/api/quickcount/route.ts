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

    let totalSuara = 0;
    for (const c of kandidatRows) totalSuara += c.suara;

    // Petugas dianggap aktif bila heartbeat terakhirnya belum lewat 90 detik
    const batasAktif = Date.now() - 90_000;

    const data = kolomRows.map((k) => ({
      id: k._id,
      nama: k.nama,
      tahap: k.tahap,
      petugasAktif: !!k.petugasAktifPada && k.petugasAktifPada.getTime() > batasAktif,
      penatua: perKolom.get(k._id)!.penatua.map(kandidatKeJson),
      diaken: perKolom.get(k._id)!.diaken.map(kandidatKeJson),
    }));

    return NextResponse.json({
      kolom: data,
      totalSuara,
      kolomSelesai: kolomRows.filter((k) => k.tahap === 'selesai').length,
      waktu: new Date().toLocaleTimeString('id-ID', { hour12: false }),
    });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}
