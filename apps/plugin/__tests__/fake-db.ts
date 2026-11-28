/**
 * In-memory stand-in for the slice of @repo/database the plugin touches.
 * Enough behaviour to drive the OAuth flow and the Pro tools end to end.
 */

// biome-ignore lint/suspicious/noExplicitAny: a loose in-memory stand-in for Prisma rows.
type Row = Record<string, any>;

export const store = {
  agents: [] as Row[],
  investorTokens: [] as Row[],
  counters: new Map<string, number>(),
  quotes: [] as Row[],
  actions: [] as Row[],
  deals: [] as Row[],
  interests: [] as Row[],
};

export function resetStore() {
  store.agents = [
    {
      id: 'agent1',
      email: 'agent@firm.co.uk',
      contactName: 'Alex Agent',
      firmName: 'Firm & Co',
      phone: '07000 000000',
      referralCode: 'FIRM1',
      totalReferrals: 0,
    },
  ];
  store.investorTokens = [
    {
      id: 'inv1',
      email: 'investor@fund.co.uk',
      label: 'Fund One',
      revoked: false,
      createdAt: new Date(),
    },
  ];
  store.counters.clear();
  store.quotes = [];
  store.actions = [];
  store.deals = [
    {
      id: 'deal_released_1',
      postcode: 'M20 2AB',
      propertyType: 'semi',
      bedrooms: 3,
      sellerType: 'probate',
      resalePricePence: 185_000_00,
      releasedForResale: true,
      releasedAt: new Date(),
      address: 'SECRET ADDRESS',
      estimatedMarketValuePence: 999,
    },
    {
      id: 'deal_hidden_1',
      postcode: 'M1 1AA',
      propertyType: 'flat',
      bedrooms: 1,
      sellerType: 'other',
      resalePricePence: 90_000_00,
      releasedForResale: false,
      releasedAt: null,
    },
  ];
  store.interests = [];
}

const ci = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const fakeDatabase = {
  agentAccount: {
    findFirst: async ({ where }: Row) =>
      store.agents.find((a) => ci(a.email, where.email.equals)) ?? null,
    update: async ({ where, data }: Row) => {
      const a = store.agents.find((x) => x.id === where.id);
      if (a && data.totalReferrals?.increment)
        a.totalReferrals += data.totalReferrals.increment;
      return a;
    },
  },
  investorAccessToken: {
    findFirst: async ({ where }: Row) =>
      store.investorTokens.find(
        (t) => t.email && ci(t.email, where.email.equals) && !t.revoked
      ) ?? null,
  },
  rateLimitCounter: {
    upsert: async ({ where }: Row) => {
      const k = `${where.bucket_subject_windowStart.bucket}|${where.bucket_subject_windowStart.subject}`;
      const n = (store.counters.get(k) ?? 0) + 1;
      store.counters.set(k, n);
      return { count: n };
    },
  },
  quoteRequest: {
    findFirst: async ({ where }: Row) =>
      store.quotes.find(
        (q) =>
          q.referralCode === where.referralCode &&
          q.postcode === where.postcode &&
          ci(q.address, where.address.equals)
      ) ?? null,
    create: async ({ data }: Row) => {
      const row = {
        id: `q${store.quotes.length + 1}`,
        createdAt: new Date(),
        ...data,
      };
      store.quotes.push(row);
      return row;
    },
    findMany: async () =>
      store.quotes.map((q) => ({ ...q, trackToken: null, dealUpdates: [] })),
  },
  founderAction: {
    create: async ({ data }: Row) => {
      store.actions.push(data);
      return data;
    },
  },
  deal: {
    findMany: async ({ where, select }: Row) =>
      store.deals
        .filter((d) => d.releasedForResale === where.releasedForResale)
        .map((d) =>
          Object.fromEntries(Object.keys(select).map((k) => [k, d[k]]))
        ),
    findUnique: async ({ where }: Row) =>
      store.deals.find((d) => d.id === where.id) ?? null,
  },
  investorInterest: {
    findUnique: async ({ where }: Row) =>
      store.interests.find(
        (i) =>
          i.dealId === where.dealId_investorEmail.dealId &&
          i.investorEmail === where.dealId_investorEmail.investorEmail
      ) ?? null,
    upsert: async ({ where, create }: Row) => {
      const found = store.interests.find(
        (i) =>
          i.dealId === where.dealId_investorEmail.dealId &&
          i.investorEmail === where.dealId_investorEmail.investorEmail
      );
      if (!found) store.interests.push(create);
      return create;
    },
  },
};
