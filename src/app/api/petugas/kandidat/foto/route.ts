import { NextResponse } from 'next/server';
import { koleksiKandidat, ObjectId, Binary } from '@/lib/db';
import { getSession } from '@/lib/auth';

const TIPE_DIIZINKAN = ['image/jpeg', 'image/png', 'image/webp'];
const MAKS_UKURAN = 2 * 1024 * 1024; // 2 MB

// POST (multipart): unggah/ganti foto kandidat — field "id" dan "foto"
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'petugas') {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Form tidak valid' }, { status: 400 });

  let id: ObjectId;
  try {
    id = new ObjectId(String(form.get('id')));
  } catch {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
  }
  const foto = form.get('foto');
  if (!(foto instanceof File)) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
  }
  if (!TIPE_DIIZINKAN.includes(foto.type)) {
    return NextResponse.json({ error: 'Format harus JPG, PNG, atau WebP' }, { status: 415 });
  }
  if (foto.size > MAKS_UKURAN) {
    return NextResponse.json({ error: 'Ukuran foto maksimal 2 MB' }, { status: 413 });
  }

  const buffer = Buffer.from(await foto.arrayBuffer());
  const res = await (await koleksiKandidat()).updateOne(
    { _id: id, kolomId: session.kolomId },
    {
      $set: { foto: new Binary(buffer), fotoTipe: foto.type },
      $inc: { fotoVersi: 1 },
    }
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ error: 'Kandidat tidak ditemukan' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE: hapus foto kandidat { id }
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'petugas') {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  let id: ObjectId;
  try {
    id = new ObjectId(String(body?.id));
  } catch {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
  }

  await (await koleksiKandidat()).updateOne(
    { _id: id, kolomId: session.kolomId },
    { $set: { foto: null, fotoTipe: null }, $inc: { fotoVersi: 1 } }
  );
  return NextResponse.json({ ok: true });
}
