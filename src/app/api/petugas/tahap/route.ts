import { NextResponse } from 'next/server';
import { koleksiKolom, koleksiKandidat, Tahap, petugasResmi } from '@/lib/db';
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

  // Pemilihan tidak boleh diselesaikan tanpa ada diaken yang dipilih
  if (tujuan === 'selesai') {
    const kandidat = await koleksiKandidat();
    const diakenBersuara = await kandidat.countDocuments({
      kolomId: session.kolomId,
      jabatan: 'diaken',
      suara: { $gt: 0 },
    });
    if (diakenBersuara === 0) {
      return NextResponse.json(
        {
          error:
            'Belum ada diaken yang dipilih — tambahkan calon diaken dan hitung suaranya ' +
            '(atau kembali ke sesi penatua untuk aklamasi) sebelum menyelesaikan pemilihan.',
        },
        { status: 409 }
      );
    }
  }

  await kolom.updateOne({ _id: session.kolomId }, { $set: { tahap: tujuan } });
  return NextResponse.json({ ok: true, tahap: tujuan });
}
