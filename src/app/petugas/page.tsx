import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { petugasResmi } from '@/lib/db';
import PanelPetugas from './PanelPetugas';

export default async function HalamanPetugas() {
  const session = await getSession();
  if (!session || session.role !== 'petugas') redirect('/login');
  // Sesi lama yang sudah digantikan login perangkat lain langsung diarahkan keluar
  if (!(await petugasResmi(session.kolomId, session.token))) redirect('/login');
  return <PanelPetugas />;
}
