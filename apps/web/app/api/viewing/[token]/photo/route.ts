import {
  LIMITS,
  checkRateLimit,
  clientIp,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { database } from '@repo/database';
import { put } from '@repo/storage';
import { NextResponse } from 'next/server';

// Photo upload for a viewing report. Token-gated + IP rate-limited; images
// land in public blob storage under the viewing id so the report can embed
// them. Blocked once the report is submitted.

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 8 * 1024 * 1024; // phone photos run large

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = clientIp(request) ?? 'unknown';
  const limit = await checkRateLimit(LIMITS.viewingPhotoByIp, ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many uploads — try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(limit.resetAt) },
      }
    );
  }

  const viewing = await database.viewing.findUnique({
    where: { token },
    select: { id: true, status: true },
  });
  if (!viewing || viewing.status === 'cancelled') {
    return NextResponse.json({ error: 'Viewing not found' }, { status: 404 });
  }
  if (viewing.status === 'submitted' || viewing.status === 'reviewed') {
    return NextResponse.json(
      { error: 'Report already submitted' },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP or HEIC photos are allowed' },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Photo must be under 8MB' },
      { status: 400 }
    );
  }

  const ext = file.type.split('/')[1] ?? 'jpg';
  const blob = await put(`viewings/${viewing.id}/${Date.now()}.${ext}`, file, {
    access: 'public',
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
