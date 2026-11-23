export type InboxLabel = 'Seller' | 'Solicitor' | 'Agent';

export type KnownSenders = {
  sellers: Set<string>;
  solicitors: Set<string>;
  agents: Set<string>;
};

/** Pull the bare address out of a From header: `"Jo Bloggs" <jo@x.co.uk>`. */
export const senderAddress = (fromHeader: string): string | null => {
  const angled = fromHeader.match(/<([^<>\s]+@[^<>\s]+)>/);
  const bare = angled?.[1] ?? fromHeader.match(/[^\s<>"]+@[^\s<>"]+/)?.[0];
  return bare ? bare.toLowerCase() : null;
};

/**
 * Which label an inbound email gets. Exact address match only: a label is
 * a statement that this person is on a deal, so we never guess from a
 * domain or a name. Unknown senders are left alone.
 *
 * Order matters when one address plays two parts: the seller wins, because
 * a missed seller email costs the most.
 */
export const classifySender = (
  fromHeader: string,
  known: KnownSenders
): InboxLabel | null => {
  const address = senderAddress(fromHeader);
  if (!address) {
    return null;
  }
  if (known.sellers.has(address)) {
    return 'Seller';
  }
  if (known.solicitors.has(address)) {
    return 'Solicitor';
  }
  if (known.agents.has(address)) {
    return 'Agent';
  }
  return null;
};
