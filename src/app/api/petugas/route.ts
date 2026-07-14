import { NextResponse } from 'next/server';
import { koleksiKandidat, kandidatKeJson, petugasResmi } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: data kolom milik petugas yang login (info kolom + daftar kandidat)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'petugas') {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }

  const kolom = await petugasResmi(session.kolomId, session.token);
  if (!kolom) {
    return NextResponse.json(
      { error: 'Sesi berakhir — kolom ini login di perangkat lain.' },
      { status: 401 }
    );
  }

  const kandidat = await (await koleksiKandidat())
    .find({ kolomId: session.kolomId }, { projection: { foto: 0 } })
    .sort({ jabatan: 1, nama: 1 })
    .toArray();

  const semua = kandidat.map(kandidatKeJson);

  return NextResponse.json({
    kolom: { id: kolom._id, nama: kolom.nama, tahap: kolom.tahap },
    penatua: semua.filter((k) => k.jabatan === 'penatua'),
    diaken: semua.filter((k) => k.jabatan === 'diaken'),
  });
}
