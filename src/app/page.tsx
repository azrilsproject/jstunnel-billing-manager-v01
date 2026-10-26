import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decrypt, SESSION_COOKIE } from '@/lib/session';

export default async function HomePage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await decrypt(token);

  if (session?.adminId) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
