import { describe, expect, it, vi } from 'vitest';

// email-templates only needs the DealUpdateKind type; stub the client so no
// database connection is attempted.
vi.mock('@repo/database', () => ({}));

import { renderUpdateEmail } from '../email-templates';

const base = {
  title: 'Update',
  trackUrl: null,
  property: { address: '12 Elm Road', postcode: 'M14 5AB' },
  offer: { offerPence: 150_000_00, completionDays: 21 },
};

describe('renderUpdateEmail — no figure before a person sends the offer', () => {
  it('never shows the figure on the acknowledgement', () => {
    const { html, text } = renderUpdateEmail({
      ...base,
      kind: 'quote_requested',
    });
    expect(html).not.toContain('150,000');
    expect(text).not.toContain('150,000');
  });

  it('never repeats the figure on a note or a decline', () => {
    for (const kind of ['note', 'offer_declined', 'delay'] as const) {
      const { html } = renderUpdateEmail({ ...base, kind });
      expect(html).not.toContain('150,000');
    }
  });

  it('shows it once the offer has been sent or accepted', () => {
    expect(renderUpdateEmail({ ...base, kind: 'offer_sent' }).html).toContain(
      '£150,000'
    );
    expect(
      renderUpdateEmail({ ...base, kind: 'offer_accepted' }).html
    ).toContain('£150,000');
  });
});
