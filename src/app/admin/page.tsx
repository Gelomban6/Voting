import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import PanelAdmin from './PanelAdmin';

export const dynamic = 'force-dynamic';

export default async function HalamanAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');
  return <PanelAdmin />;
}
