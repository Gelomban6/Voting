import { NextResponse } from 'next/server';
import { koleksiKolom, koleksiKandidat } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST: reset data { jenis: 'suara' | 'semua' }
// - 'suara': nolkan semua suara + kembalikan tahap ke penatua (kandidat tetap)
// - 'semua': hapus semua kandidat + kembalikan tahap ke penatua
export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const jenis = body?.jenis;
  const kolom = await koleksiKolom();
  const kandidat = await koleksiKandidat();

  if (jenis === 'suara') {
    await kandidat.updateMany({}, { $set: { suara: 0 } });
    await kolom.updateMany({}, { $set: { tahap: 'penatua' } });
    return NextResponse.json({ ok: true });
  }
  if (jenis === 'semua') {
    await kandidat.deleteMany({});
    await kolom.updateMany({}, { $set: { tahap: 'penatua' } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Jenis reset tidak dikenal' }, { status: 400 });
}
