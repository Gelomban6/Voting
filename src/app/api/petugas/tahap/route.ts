import { NextResponse } from 'next/server';
import { koleksiKolom, Tahap, petugasResmi } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Transisi tahap yang diizinkan (maju dan mundur satu langkah)
const TRANSISI: Record<Tahap, Tahap[]> = {
  penatua: ['diaken'],
  diaken: ['penatua', 'selesai'],
  selesai: ['diaken'],
};

// POST: ubah tahap kolom { tahap }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'petugas') {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tujuan = body?.tahap as Tahap;
  if (!['penatua', 'diaken', 'selesai'].includes(tujuan)) {
    return NextResponse.json({ error: 'Tahap tidak valid' }, { status: 400 });
  }

  const sekarang = await petugasResmi(session.kolomId, session.token);
  if (!sekarang) {
    return NextResponse.json(
      { error: 'Sesi berakhir — kolom ini login di perangkat lain.' },
      { status: 401 }
    );
  }
  const kolom = await koleksiKolom();

  if (!TRANSISI[sekarang.tahap].includes(tujuan)) {
    return NextResponse.json(
      { error: `Tidak bisa pindah dari tahap ${sekarang.tahap} ke ${tujuan}` },
      { status: 409 }
    );
  }

  await kolom.updateOne({ _id: session.kolomId }, { $set: { tahap: tujuan } });
  return NextResponse.json({ ok: true, tahap: tujuan });
}
