import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/app/partners/_lib/auth';

export async function POST(request: Request) {
  await clearSessionCookie();
  const url = new URL(request.url);
  return NextResponse.redirect(
    `${url.protocol}//${url.host}/partners/login`,
    { status: 303 },
  );
}
