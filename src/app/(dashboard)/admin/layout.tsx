import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';

/** Admin pages are for portal admins only; everyone else goes to their own home. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.profile?.role !== 'admin') redirect('/dashboard');
  return <>{children}</>;
}
