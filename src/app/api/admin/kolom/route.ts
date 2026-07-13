import { NextResponse } from 'next/server';
import { koleksiKolom, koleksiKandidat, Tahap } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function adminOnly() {
  const session = await getSession();
  return session?.role === 'admin';
}

// GET: semua kolom termasuk kode akses + ringkasan kandidat/suara
export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });

  const kolomRows = await (await koleksiKolom()).find().sort({ _id: 1 }).toArray();
  const ringkasan = await (await koleksiKandidat())
    .aggregate<{ _id: number; jumlahKandidat: number; totalSuara: number }>([
      { $group: { _id: '$kolomId', jumlahKandidat: { $sum: 1 }, totalSuara: { $sum: '$suara' } } },
    ])
    .toArray();
  const perKolom = new Map(ringkasan.map((r) => [r._id, r]));

  return NextResponse.json({
    kolom: kolomRows.map((k) => ({
      id: k._id,
      nama: k.nama,
      kode: k.kode,
      tahap: k.tahap,
      jumlahKandidat: perKolom.get(k._id)?.jumlahKandidat ?? 0,
      totalSuara: perKolom.get(k._id)?.totalSuara ?? 0,
    })),
  });
}

// PATCH: ubah kolom { id, nama?, kode?, tahap? }
export async function PATCH(req: Request) {
  if (!(await adminOnly())) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

  const set: Partial<{ nama: string; kode: string; tahap: Tahap }> = {};
  if (typeof body.nama === 'string' && body.nama.trim()) set.nama = body.nama.trim();
  if (typeof body.kode === 'string' && body.kode.trim()) set.kode = body.kode.trim();
  if (['penatua', 'diaken', 'selesai'].includes(body.tahap as Tahap)) set.tahap = body.tahap;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });
  }

  await (await koleksiKolom()).updateOne({ _id: id }, { $set: set });
  return NextResponse.json({ ok: true });
}
