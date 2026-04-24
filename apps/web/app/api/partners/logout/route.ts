import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/app/partners/_lib/auth';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
