import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { koleksiKolom } from '@/lib/db';
import { config } from '@/lib/config';
import { setSessionCookie } from '@/lib/auth';

function samaAman(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 });

  if (body.mode === 'admin') {
    if (typeof body.password === 'string' && samaAman(body.password, config.adminPassword)) {
      await setSessionCookie({ role: 'admin' });
      return NextResponse.json({ ok: true, role: 'admin' });
    }
    return NextResponse.json({ error: 'Password admin salah' }, { status: 401 });
  }

  if (body.mode === 'petugas') {
    const kolomId = Number(body.kolomId);
    const kode = String(body.kode ?? '');
    const koleksi = await koleksiKolom();
    const kolom = await koleksi.findOne({ _id: kolomId });
    if (kolom && samaAman(kode, kolom.kode)) {
      // Satu sesi aktif per kolom: token baru menggantikan sesi perangkat lama
      const token = crypto.randomBytes(16).toString('hex');
      await koleksi.updateOne(
        { _id: kolomId },
        { $set: { sesiToken: token, petugasAktifPada: new Date() } }
      );
      await setSessionCookie({ role: 'petugas', kolomId, token });
      return NextResponse.json({ ok: true, role: 'petugas', kolomId });
    }
    return NextResponse.json({ error: 'Kode kolom salah' }, { status: 401 });
  }

  return NextResponse.json({ error: 'Mode tidak dikenal' }, { status: 400 });
}
