import { NextResponse } from 'next/server';
import { koleksiKolom, koleksiKandidat, ObjectId } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST: tambah/kurangi satu suara { kandidatId, delta: 1 | -1 }
// Hanya berlaku bila jabatan kandidat = tahap kolom yang sedang berlangsung,
// sehingga otomatis terkunci saat sesi sudah diselesaikan.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'petugas') {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const delta = Number(body?.delta);
  let kandidatId: ObjectId;
  try {
    kandidatId = new ObjectId(String(body?.kandidatId));
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 });
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 });
  }

  const kolom = await (await koleksiKolom()).findOne({ _id: session.kolomId });
  if (!kolom) return NextResponse.json({ error: 'Kolom tidak ditemukan' }, { status: 404 });
  if (kolom.tahap === 'selesai') {
    return NextResponse.json(
      { error: 'Suara terkunci — sesi jabatan ini tidak sedang berlangsung.' },
      { status: 409 }
    );
  }

  const kandidat = await koleksiKandidat();
  const hasil = await kandidat.findOneAndUpdate(
    {
      _id: kandidatId,
      kolomId: session.kolomId,
      jabatan: kolom.tahap, // hanya sesi yang sedang berlangsung
      ...(delta === -1 ? { suara: { $gte: 1 } } : {}), // tidak boleh di bawah nol
    },
    { $inc: { suara: delta } },
    { returnDocument: 'after', projection: { suara: 1 } }
  );

  if (!hasil) {
    return NextResponse.json(
      { error: 'Suara terkunci — sesi jabatan ini tidak sedang berlangsung.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, suara: hasil.suara });
}
