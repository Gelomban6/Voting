import { koleksiKandidat, ObjectId } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: sajikan foto kandidat (publik, dipakai kartu quick count & panel petugas)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let kandidatId: ObjectId;
  try {
    kandidatId = new ObjectId(id);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const kandidat = await (await koleksiKandidat()).findOne(
    { _id: kandidatId },
    { projection: { foto: 1, fotoTipe: 1 } }
  );
  if (!kandidat?.foto || !kandidat.fotoTipe) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(new Uint8Array(kandidat.foto.buffer), {
    headers: {
      'Content-Type': kandidat.fotoTipe,
      // Aman di-cache lama: URL memuat ?v=<fotoVersi> yang berubah tiap unggah
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
