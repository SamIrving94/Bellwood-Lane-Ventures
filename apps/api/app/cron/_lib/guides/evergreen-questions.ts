/**
 * The evergreen question list.
 *
 * Every guide answers ONE of these. They are the questions sellers, executors
 * and agents type into Google in March and again in September; the answer
 * does not change with the news. The weekly research supplies an opening
 * hook and a current fact, never the topic. Founder decision, 17 Sep 2026:
 * evergreen questions are what we publish; news reaction is LinkedIn's job.
 *
 * `landing` must be a live apps/web route. The test in
 * apps/api/__tests__/guides.test.ts checks each against LANDING_ROUTES so a
 * guide can never CTA to a page that does not exist.
 */

export type GuideSegment =
  | 'probate'
  | 'chain_break'
  | 'separation'
  | 'relocation'
  | 'distress'
  | 'problem_property'
  | 'agent';

export type EvergreenQuestion = {
  /** Stable id. Used for rotation; never rename once a guide exists. */
  key: string;
  /** The question as a reader would ask it. Becomes the working title. */
  question: string;
  segment: GuideSegment;
  /** Head term for the title and first paragraph. */
  primaryKeyword: string;
  /** Live apps/web route the closing CTA points to. */
  landing: string;
};

/** Live public routes a guide may link to. Keep in step with apps/web/app. */
export const LANDING_ROUTES = [
  '/sell',
  '/probate',
  '/chain-break',
  '/separation',
  '/relocation',
  '/problem-property',
  '/your-situation',
  '/agents',
  '/save-the-sale',
  '/why-we-wont-buy-any-home',
  '/instant-offer/methodology',
] as const;

export const EVERGREEN_QUESTIONS: readonly EvergreenQuestion[] = [
  // ── Probate ──────────────────────────────────────────────────────────
  {
    key: 'probate-after-grant',
    question: 'What happens to a house after probate is granted?',
    segment: 'probate',
    primaryKeyword: 'what happens to a house after probate is granted',
    landing: '/probate',
  },
  {
    key: 'probate-sell-before-grant',
    question: 'Can you sell a house before probate is granted?',
    segment: 'probate',
    primaryKeyword: 'sell house before probate granted',
    landing: '/probate',
  },
  {
    key: 'probate-executor-costs',
    question: 'What costs should an executor expect when selling a property?',
    segment: 'probate',
    primaryKeyword: 'executor selling property costs',
    landing: '/probate',
  },
  {
    key: 'probate-empty-house',
    question: 'What do you need to do with an empty inherited house?',
    segment: 'probate',
    primaryKeyword: 'empty inherited house what to do',
    landing: '/probate',
  },
  {
    key: 'probate-siblings-disagree',
    question: 'What happens when beneficiaries disagree about selling a house?',
    segment: 'probate',
    primaryKeyword: 'beneficiaries disagree selling inherited house',
    landing: '/probate',
  },
  // ── Chain break ──────────────────────────────────────────────────────
  {
    key: 'chain-buyer-pulled-out',
    question: 'What should you do when your buyer pulls out?',
    segment: 'chain_break',
    primaryKeyword: 'buyer pulled out what to do',
    landing: '/chain-break',
  },
  {
    key: 'chain-relist-or-cash',
    question: 'Should you accept a cash offer or relist after a chain breaks?',
    segment: 'chain_break',
    primaryKeyword: 'cash offer or relist after chain break',
    landing: '/chain-break',
  },
  {
    key: 'chain-how-often-fall-through',
    question: 'How often do house sales fall through, and why?',
    segment: 'chain_break',
    primaryKeyword: 'how often do house sales fall through',
    landing: '/chain-break',
  },
  {
    key: 'chain-completion-timeline',
    question: 'How quickly can a property sale realistically complete?',
    segment: 'chain_break',
    primaryKeyword: 'how quickly can a house sale complete',
    landing: '/sell',
  },
  // ── Cash buyers, generally ───────────────────────────────────────────
  {
    key: 'cash-how-offers-calculated',
    question: 'How do cash house-buying companies calculate their offers?',
    segment: 'chain_break',
    primaryKeyword: 'how do cash house buyers calculate offers',
    landing: '/instant-offer/methodology',
  },
  {
    key: 'cash-offer-dropped-last-minute',
    question:
      'Why do cash offers drop at the last minute, and how do you stop it?',
    segment: 'chain_break',
    primaryKeyword: 'cash buyer reduced offer before exchange',
    landing: '/instant-offer/methodology',
  },
  {
    key: 'cash-what-is-cash-only-listing',
    question: 'What does "cash buyers only" mean on a property listing?',
    segment: 'problem_property',
    primaryKeyword: 'cash buyers only meaning',
    landing: '/problem-property',
  },
  // ── Problem property ─────────────────────────────────────────────────
  {
    key: 'problem-major-repairs',
    question: 'Can you sell a house that needs major repairs?',
    segment: 'problem_property',
    primaryKeyword: 'sell house that needs major repairs',
    landing: '/problem-property',
  },
  {
    key: 'problem-short-lease',
    question: 'Can you sell a flat with a short lease?',
    segment: 'problem_property',
    primaryKeyword: 'selling flat with short lease',
    landing: '/problem-property',
  },
  {
    key: 'problem-knotweed',
    question: 'Can you sell a house with Japanese knotweed?',
    segment: 'problem_property',
    primaryKeyword: 'selling house with japanese knotweed',
    landing: '/problem-property',
  },
  {
    key: 'problem-unmortgageable',
    question: 'What makes a property unmortgageable, and who can buy it?',
    segment: 'problem_property',
    primaryKeyword: 'unmortgageable property who will buy',
    landing: '/problem-property',
  },
  // ── Separation and relocation ────────────────────────────────────────
  {
    key: 'separation-selling-shared-home',
    question: 'How do you sell a shared home after a separation?',
    segment: 'separation',
    primaryKeyword: 'selling house after separation',
    landing: '/separation',
  },
  {
    key: 'separation-one-wants-to-sell',
    question: 'What happens if one owner wants to sell and the other does not?',
    segment: 'separation',
    primaryKeyword: 'one owner wants to sell other does not',
    landing: '/separation',
  },
  {
    key: 'relocation-sell-to-a-date',
    question: 'How do you sell a house to a fixed date when relocating?',
    segment: 'relocation',
    primaryKeyword: 'sell house quickly relocating',
    landing: '/relocation',
  },
  // ── Financial difficulty ─────────────────────────────────────────────
  {
    key: 'distress-sell-before-repossession',
    question: 'Can you sell your house to stop a repossession?',
    segment: 'distress',
    primaryKeyword: 'sell house to stop repossession',
    landing: '/your-situation',
  },
  {
    key: 'distress-arrears-options',
    question: 'What are your options if you are behind on your mortgage?',
    segment: 'distress',
    primaryKeyword: 'behind on mortgage options uk',
    landing: '/your-situation',
  },
  // ── Agents ───────────────────────────────────────────────────────────
  {
    key: 'agent-indicative-assessment-info',
    question:
      'What information should an agent send a cash buyer for an assessment?',
    segment: 'agent',
    primaryKeyword: 'what to send cash buyer property assessment',
    landing: '/agents',
  },
  {
    key: 'agent-save-a-sale',
    question: 'How can an estate agent save a sale when the chain collapses?',
    segment: 'agent',
    primaryKeyword: 'estate agent chain collapse save sale',
    landing: '/save-the-sale',
  },
];

export function findQuestion(key: string): EvergreenQuestion | undefined {
  return EVERGREEN_QUESTIONS.find((q) => q.key === key);
}

/**
 * Rotation. Questions written in the last `windowWeeks` are excluded; the
 * remainder come back in list order, so a fresh site works through the list
 * top to bottom and a mature one cycles. `recentKeys` is newest first.
 */
export function candidateQuestions(
  recentKeys: readonly string[]
): EvergreenQuestion[] {
  const recent = new Set(recentKeys);
  const fresh = EVERGREEN_QUESTIONS.filter((q) => !recent.has(q.key));
  if (fresh.length > 0) return fresh;
  // Every question has a guide inside the window: revisit the oldest first.
  const order = new Map(recentKeys.map((k, i) => [k, i]));
  return [...EVERGREEN_QUESTIONS].sort(
    (a, b) => (order.get(b.key) ?? -1) - (order.get(a.key) ?? -1)
  );
}
