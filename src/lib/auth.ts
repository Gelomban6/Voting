import crypto from 'crypto';
import { cookies } from 'next/headers';
import { config } from './config';

export type Session =
  | { role: 'admin'; token?: string; exp?: number }
  | { role: 'petugas'; kolomId: number; token?: string; exp?: number };

const COOKIE = 'voting_session';

declare global {
  // eslint-disable-next-line no-var
  var _votingAdminActiveToken: string | undefined;
}

export function setAdminActiveToken(token: string): void {
  global._votingAdminActiveToken = token;
}

export function clearAdminActiveToken(): void {
  global._votingAdminActiveToken = 'invalidated_' + Date.now();
}

export function isValidAdminToken(token?: string): boolean {
  if (!global._votingAdminActiveToken) return true;
  return global._votingAdminActiveToken === token;
}

function hmac(payload: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
}

export function signSession(session: Session): string {
  const exp = session.exp ?? Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 jam
  const payload = Buffer.from(JSON.stringify({ ...session, exp })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

export function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    if (session.exp && typeof session.exp === 'number') {
      if (Math.floor(Date.now() / 1000) > session.exp) {
        return null; // Sesi telah kedaluwarsa
      }
    }
    if (session.role === 'admin' && !isValidAdminToken(session.token)) {
      return null; // Sesi admin telah dicabut atau diganti
    }
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value);
}

export async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, signSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 jam
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
