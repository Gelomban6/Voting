import { NextResponse } from 'next/server';
import { koleksiKolom, koleksiKandidat, ObjectId } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST: aklamasi — diaken ditetapkan dari peringkat 2 suara penatua,
// tanpa sesi voting diaken. Kolom langsung berstatus selesai.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'petugas') {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }

  const kolom = await koleksiKolom();
  const kandidat = await koleksiKandidat();

  const k = await kolom.findOne({ _id: session.kolomId });
  if (!k) return NextResponse.json({ error: 'Kolom tidak ditemukan' }, { status: 404 });
  if (k.tahap !== 'penatua') {
    return NextResponse.json(
      { error: 'Aklamasi hanya bisa dilakukan saat sesi penatua (sebelum voting diaken dimulai).' },
      { status: 409 }
    );
  }

  const penatua = await kandidat
    .find({ kolomId: session.kolomId, jabatan: 'penatua' })
    .sort({ suara: -1, nama: 1 })
    .toArray();

  if (penatua.length < 2) {
    return NextResponse.json(
      { error: 'Aklamasi butuh minimal 2 calon penatua.' },
      { status: 409 }
    );
  }

  const [pertama, kedua, ketiga] = penatua;
  if (kedua.suara <= 0) {
    return NextResponse.json(
      { error: 'Calon peringkat 2 belum memiliki suara.' },
      { status: 409 }
    );
  }
  if (pertama.suara === kedua.suara) {
    return NextResponse.json(
      { error: 'Suara peringkat 1 dan 2 seri — peringkat belum jelas, aklamasi tidak bisa dilakukan.' },
      { status: 409 }
    );
  }
  if (ketiga && ketiga.suara === kedua.suara) {
    return NextResponse.json(
      { error: 'Ada lebih dari satu calon di peringkat 2 (seri) — aklamasi tidak bisa dilakukan.' },
      { status: 409 }
    );
  }

  // Ganti seluruh calon diaken dengan hasil aklamasi
  await kandidat.deleteMany({ kolomId: session.kolomId, jabatan: 'diaken' });
  await kandidat.insertOne({
    _id: new ObjectId(),
    kolomId: session.kolomId,
    jabatan: 'diaken',
    nama: kedua.nama,
    suara: kedua.suara, // suara bawaan dari sesi penatua, ditandai aklamasi
    aklamasi: true,
    foto: kedua.foto ?? null,
    fotoTipe: kedua.fotoTipe ?? null,
    fotoVersi: (kedua.fotoVersi ?? 0) + 1,
  });
  await kolom.updateOne({ _id: session.kolomId }, { $set: { tahap: 'selesai' } });

  return NextResponse.json({ ok: true, nama: kedua.nama });
}
