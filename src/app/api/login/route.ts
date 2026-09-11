import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { koleksiKolom } from '@/lib/db';
import { config } from '@/lib/config';
import { setSessionCookie, setAdminActiveToken } from '@/lib/auth';

// Rate limiter berbasis IP untuk menangkal serangan brute force login
const riwayatGagalLogin = new Map<string, { jumlah: number; batasWaktu: number }>();
const MAKS_PERCOBAAN_GAGAL = 5;
const DURASI_BLOKIR_MS = 60_000; // 1 menit

function dapatkanIpKlien(req: Request): string {
  const diteruskan = req.headers.get('x-forwarded-for');
  if (diteruskan) {
    return diteruskan.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

function periksaIzinLogin(ip: string): boolean {
  const sekarang = Date.now();
  const catatan = riwayatGagalLogin.get(ip);
  if (!catatan) return true;
  if (sekarang > catatan.batasWaktu) {
    riwayatGagalLogin.delete(ip);
    return true;
  }
  return catatan.jumlah < MAKS_PERCOBAAN_GAGAL;
}

function catatLoginGagal(ip: string): void {
  const sekarang = Date.now();
  const catatan = riwayatGagalLogin.get(ip);
  if (!catatan || sekarang > catatan.batasWaktu) {
    riwayatGagalLogin.set(ip, { jumlah: 1, batasWaktu: sekarang + DURASI_BLOKIR_MS });
  } else {
    catatan.jumlah += 1;
  }
}

function resetLoginGagal(ip: string): void {
  riwayatGagalLogin.delete(ip);
}

function samaAman(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: Request) {
  const ip = dapatkanIpKlien(req);
  if (!periksaIzinLogin(ip)) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan login yang gagal. Silakan tunggu 1 menit.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 });

  if (body.mode === 'admin') {
    if (typeof body.password === 'string' && samaAman(body.password, config.adminPassword)) {
      resetLoginGagal(ip);
      const token = crypto.randomBytes(16).toString('hex');
      setAdminActiveToken(token);
      await setSessionCookie({ role: 'admin', token });
      return NextResponse.json({ ok: true, role: 'admin' });
    }
    catatLoginGagal(ip);
    return NextResponse.json({ error: 'Password admin salah' }, { status: 401 });
  }

  if (body.mode === 'petugas') {
    const kolomId = Number(body.kolomId);
    const kode = String(body.kode ?? '');
    const koleksi = await koleksiKolom();
    const kolom = await koleksi.findOne({ _id: kolomId });
    if (kolom && samaAman(kode, kolom.kode)) {
      resetLoginGagal(ip);
      // Satu sesi aktif per kolom: token baru menggantikan sesi perangkat lama
      const token = crypto.randomBytes(16).toString('hex');
      await koleksi.updateOne(
        { _id: kolomId },
        { $set: { sesiToken: token, petugasAktifPada: new Date() } }
      );
      await setSessionCookie({ role: 'petugas', kolomId, token });
      return NextResponse.json({ ok: true, role: 'petugas', kolomId });
    }
    catatLoginGagal(ip);
    return NextResponse.json({ error: 'Kode kolom salah' }, { status: 401 });
  }

  return NextResponse.json({ error: 'Mode tidak dikenal' }, { status: 400 });
}
