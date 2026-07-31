import { clearSessionCookie } from '@/app/partners/_lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  await clearSessionCookie();
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.protocol}//${url.host}/partners/login`, {
    status: 303,
  });
}
