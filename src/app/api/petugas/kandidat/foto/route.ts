import { NextResponse } from 'next/server';
import { koleksiKandidat, ObjectId, Binary, petugasResmi } from '@/lib/db';
import { getSession } from '@/lib/auth';

async function sesiPetugasValid() {
  const session = await getSession();
  if (!session || session.role !== 'petugas') return null;
  if (!(await petugasResmi(session.kolomId, session.token))) return null;
  return session;
}

const TIPE_DIIZINKAN = ['image/jpeg', 'image/png', 'image/webp'];
const MAKS_UKURAN = 2 * 1024 * 1024; // 2 MB

function deteksiTipeGambar(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF ... WEBP
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

// POST (multipart): unggah/ganti foto kandidat — field "id" dan "foto"
export async function POST(req: Request) {
  const session = await sesiPetugasValid();
  if (!session) {
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
  const tipeAsli = deteksiTipeGambar(buffer);
  if (!tipeAsli) {
    return NextResponse.json({ error: 'File gambar rusak atau format tidak didukung' }, { status: 415 });
  }

  const res = await (await koleksiKandidat()).updateOne(
    { _id: id, kolomId: session.kolomId },
    {
      $set: { foto: new Binary(buffer), fotoTipe: tipeAsli },
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
  const session = await sesiPetugasValid();
  if (!session) {
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
