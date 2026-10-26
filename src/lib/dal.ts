import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decrypt, SESSION_COOKIE } from './session';

/** Wajib dipanggil di setiap page & server action yang butuh login */
export const verifySession = cache(async () => {
  const store = await cookies();
  const session = await decrypt(store.get(SESSION_COOKIE)?.value);
  if (!session?.adminId) redirect('/login');
  return session;
});
