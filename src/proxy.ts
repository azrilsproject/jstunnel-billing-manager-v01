import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/isolir', '/api/cron'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const token = request.cookies.get('jb_session')?.value;
  let valid = false;
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET));
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!isPublic && !valid) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (pathname === '/login' && valid) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)'],
};
