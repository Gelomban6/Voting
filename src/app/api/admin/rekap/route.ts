import { NextResponse } from 'next/server';
import { koleksiKolom, koleksiKandidat, KandidatDoc, KolomDoc } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }

  const kolomRows: KolomDoc[] = await (await koleksiKolom()).find().sort({ _id: 1 }).toArray();
  const kandidatRows: KandidatDoc[] = await (await koleksiKandidat())
    .find({}, { projection: { foto: 0 } })
    .sort({ suara: -1, nama: 1 })
    .toArray();

  const dataKolom = kolomRows.map((k) => {
    const penatua = kandidatRows.filter((c) => c.kolomId === k._id && c.jabatan === 'penatua');
    const diaken = kandidatRows.filter((c) => c.kolomId === k._id && c.jabatan === 'diaken');
    const totalSuara = [...penatua, ...diaken].reduce((a, b) => a + b.suara, 0);

    // Penatua terpilih
    const maksPenatua = Math.max(0, ...penatua.map((c) => c.suara));
    const teratasPenatua = penatua.filter((c) => c.suara === maksPenatua && maksPenatua > 0);
    const penatuaTerpilih = teratasPenatua.length === 1 ? teratasPenatua[0].nama : teratasPenatua.length > 1 ? `SERI (${teratasPenatua.map((c) => c.nama).join(', ')})` : '-';

    // Diaken terpilih
    const maksDiaken = Math.max(0, ...diaken.map((c) => c.suara));
    const teratasDiaken = diaken.filter((c) => c.suara === maksDiaken && maksDiaken > 0);
    const diakenTerpilih = teratasDiaken.length === 1 
      ? `${teratasDiaken[0].nama}${teratasDiaken[0].aklamasi ? ' (Aklamasi)' : ''}` 
      : teratasDiaken.length > 1 
        ? `SERI (${teratasDiaken.map((c) => c.nama).join(', ')})` 
        : '-';

    return {
      id: k._id,
      nama: k.nama,
      kode: k.kode,
      tahap: k.tahap,
      totalSuara,
      penatuaTerpilih,
      penatuaSuara: teratasPenatua.length === 1 ? teratasPenatua[0].suara : 0,
      diakenTerpilih,
      diakenSuara: teratasDiaken.length === 1 ? teratasDiaken[0].suara : 0,
      penatua: penatua.map((p) => ({ nama: p.nama, suara: p.suara, aklamasi: !!p.aklamasi })),
      diaken: diaken.map((d) => ({ nama: d.nama, suara: d.suara, aklamasi: !!d.aklamasi })),
    };
  });

  return NextResponse.json({
    waktuCetak: new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }),
    totalSuaraGereja: kandidatRows.reduce((a, b) => a + b.suara, 0),
    kolomSelesai: kolomRows.filter((k) => k.tahap === 'selesai').length,
    totalKolom: kolomRows.length,
    data: dataKolom,
  });
}
