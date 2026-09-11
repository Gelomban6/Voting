import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession, clearAdminActiveToken } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  if (session?.role === 'admin') {
    clearAdminActiveToken();
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
