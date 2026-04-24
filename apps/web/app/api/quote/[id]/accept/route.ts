import { NextResponse } from 'next/server';
import { database } from '@repo/database';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const quote = await database.quoteRequest.findUnique({
      where: { id },
      include: { offer: true },
    });

    if (!quote || !quote.offer) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status === 'accepted') {
      return NextResponse.json({ ok: true, alreadyAccepted: true });
    }

    if (quote.offer.lockedUntil < new Date()) {
      return NextResponse.json(
        { error: 'This offer has expired.' },
        { status: 410 },
      );
    }

    await database.quoteRequest.update({
      where: { id },
      data: { status: 'accepted' },
    });

    await database.quoteOffer.update({
      where: { id: quote.offer.id },
      data: { acceptedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[quote/accept] failed', err);
    return NextResponse.json(
      { error: 'Could not reserve this offer.' },
      { status: 500 },
    );
  }
}
