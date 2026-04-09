import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Public seller intake endpoint — no auth required
// Creates a deal from the public /sell form
export const POST = async (request: Request) => {
  try {
    const body = await request.json();

    const {
      address,
      postcode,
      propertyType,
      bedrooms,
      reason,
      askingPrice,
      name,
      email,
      phone,
    } = body;

    if (!address || !postcode || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: address, postcode, name, email' },
        { status: 400 }
      );
    }

    // Map reason to seller type
    const sellerTypeMap: Record<string, string> = {
      chain_break: 'chain_break',
      probate: 'probate',
      relocation: 'relocation',
      repossession: 'repossession',
      short_lease: 'short_lease',
    };

    const deal = await database.deal.create({
      data: {
        address,
        postcode: postcode.toUpperCase().trim(),
        propertyType: propertyType || 'unknown',
        bedrooms: bedrooms ? Number.parseInt(bedrooms, 10) : undefined,
        sellerType: (sellerTypeMap[reason] as any) || 'standard',
        source: 'intake_form',
        askingPricePence: askingPrice
          ? Math.round(Number.parseFloat(askingPrice) * 100)
          : undefined,
        sellerName: name,
        sellerEmail: email,
        sellerPhone: phone || undefined,
      },
    });

    // Log the activity
    await database.dealActivity.create({
      data: {
        dealId: deal.id,
        action: 'deal_created',
        detail: `Submitted via public seller intake form. Reason: ${reason || 'not specified'}`,
      },
    });

    // TODO: Send confirmation email via @repo/email
    // TODO: Send Slack/email notification to sales team

    return NextResponse.json({ success: true, dealId: deal.id });
  } catch (error) {
    console.error('Intake form error:', error);
    return NextResponse.json(
      { error: 'Failed to process submission' },
      { status: 500 }
    );
  }
};
