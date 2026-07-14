import { NextResponse } from 'next/server';
import { koleksiKandidat, ObjectId, petugasResmi } from '@/lib/db';
import { getSession } from '@/lib/auth';

async function petugasSession() {
  const session = await getSession();
  if (!session || session.role !== 'petugas') return null;
  if (!(await petugasResmi(session.kolomId, session.token))) return null;
  return session;
}

function keObjectId(nilai: unknown): ObjectId | null {
  try {
    return new ObjectId(String(nilai));
  } catch {
    return null;
  }
}

// POST: tambah kandidat { nama, jabatan }
export async function POST(req: Request) {
  const session = await petugasSession();
  if (!session) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const nama = String(body?.nama ?? '').trim();
  const jabatan = body?.jabatan;
  if (!nama || !['penatua', 'diaken'].includes(jabatan)) {
    return NextResponse.json({ error: 'Nama dan jabatan wajib diisi' }, { status: 400 });
  }

  const res = await (await koleksiKandidat()).insertOne({
    _id: new ObjectId(),
    kolomId: session.kolomId,
    jabatan,
    nama,
    suara: 0,
    foto: null,
    fotoTipe: null,
    fotoVersi: 0,
  });
  return NextResponse.json({ ok: true, id: res.insertedId.toString() });
}

// PATCH: ubah nama kandidat { id, nama }
export async function PATCH(req: Request) {
  const session = await petugasSession();
  if (!session) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = keObjectId(body?.id);
  const nama = String(body?.nama ?? '').trim();
  if (!id || !nama) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

  await (await koleksiKandidat()).updateOne(
    { _id: id, kolomId: session.kolomId },
    { $set: { nama } }
  );
  return NextResponse.json({ ok: true });
}

// DELETE: hapus kandidat { id }
export async function DELETE(req: Request) {
  const session = await petugasSession();
  if (!session) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = keObjectId(body?.id);
  if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

  const res = await (await koleksiKandidat()).deleteOne({ _id: id, kolomId: session.kolomId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ error: 'Kandidat tidak ditemukan' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
