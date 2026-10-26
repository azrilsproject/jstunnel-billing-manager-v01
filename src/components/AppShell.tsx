import { cookies } from 'next/headers';
import { decrypt, SESSION_COOKIE } from '@/lib/session';
import { Sidebar } from '@/components/Sidebar';
import { getSettings } from '@/lib/settings';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await decrypt(token);

  let companyName = 'JAMES NET';
  if (session?.adminId) {
    try {
      const s = await getSettings();
      if (s.company_name) companyName = s.company_name;
    } catch {
      // fallback
    }
  }

  if (session?.adminId) {
    return (
      <div className="app-container">
        <Sidebar adminName={session.name || session.username} companyName={companyName} />
        <main className="main-content">{children}</main>
      </div>
    );
  }

  return <div style={{ minHeight: '100vh' }}>{children}</div>;
}
