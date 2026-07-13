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

// PUT: atur jumlah kolom { jumlah }
// - Menambah: kolom baru dibuat dengan nama & kode bawaan
// - Mengurangi: kolom bernomor lebih besar DIHAPUS beserta kandidat & suaranya
export async function PUT(req: Request) {
  if (!(await adminOnly())) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const jumlah = Math.floor(Number(body?.jumlah));
  if (!Number.isFinite(jumlah) || jumlah < 1 || jumlah > 99) {
    return NextResponse.json({ error: 'Jumlah kolom harus antara 1 dan 99' }, { status: 400 });
  }

  const kolom = await koleksiKolom();
  const kandidat = await koleksiKandidat();

  // Tambah kolom yang belum ada (upsert agar aman dijalankan berulang)
  await kolom.bulkWrite(
    Array.from({ length: jumlah }, (_, i) => ({
      updateOne: {
        filter: { _id: i + 1 },
        update: {
          $setOnInsert: {
            nama: `Kolom ${i + 1}`,
            kode: `kolom${i + 1}`,
            tahap: 'penatua' as Tahap,
          },
        },
        upsert: true,
      },
    }))
  );

  // Hapus kolom di atas jumlah baru beserta seluruh datanya
  const sisa = await kolom.deleteMany({ _id: { $gt: jumlah } });
  if (sisa.deletedCount > 0) {
    await kandidat.deleteMany({ kolomId: { $gt: jumlah } });
  }

  return NextResponse.json({ ok: true, jumlah });
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
