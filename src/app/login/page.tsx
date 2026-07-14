import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { petugasResmi } from '@/lib/db';
import FormLogin from './FormLogin';

export default async function HalamanLogin() {
  // Yang sudah login langsung diarahkan ke panelnya, tidak perlu login ulang
  const session = await getSession();
  if (session?.role === 'admin') redirect('/admin');
  if (session?.role === 'petugas') {
    // Hanya bila sesinya masih berlaku (belum digantikan login perangkat lain)
    if (await petugasResmi(session.kolomId, session.token)) redirect('/petugas');
  }
  return <FormLogin />;
}
