import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import PanelPetugas from './PanelPetugas';

export default async function HalamanPetugas() {
  const session = await getSession();
  if (!session || session.role !== 'petugas') redirect('/login');
  return <PanelPetugas />;
}
