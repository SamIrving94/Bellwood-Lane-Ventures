/**
 * What's New — the release notes behind the login "moment of joy" popup.
 *
 * HOW TO ANNOUNCE A FEATURE: add an entry to the TOP of WHATS_NEW with a
 * fresh `id`. The popup shows the newest entry once per browser (dismissal
 * is remembered in localStorage under the entry id), so a new id = a new
 * moment for everyone at next login.
 *
 * Copy rules (the founders read fast, one is dyslexic): short lines, bold
 * keywords, one emoji per bullet, playful but concrete — say what they can
 * DO now, not what was implemented.
 */

export type WhatsNewEntry = {
  /** Stable slug — changing it re-shows the popup to everyone. */
  id: string;
  /** ISO date, display only. */
  date: string;
  emoji: string;
  title: string;
  intro: string;
  bullets: { emoji: string; text: string }[];
  cta?: { label: string; href: string };
};

/** Newest first. The popup shows index 0. */
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: '2026-08-01-sell-page-shows-its-maths',
    date: '2026-08-01',
    emoji: '🧮',
    title: 'The seller page now shows its maths',
    intro:
      'Design-review round one shipped: the honest breakdown, real proof, a real face.',
    bullets: [
      {
        emoji: '🧮',
        text: 'New **"The maths"** section on /sell — market estimate → **our margin, named** → the figure we sign. The agent route is shown beside it and **wins the price line on purpose**.',
      },
      {
        emoji: '🧾',
        text: 'A **proof band** on /sell and /agents — one claim, one clickable third-party proof (PRS, TPO, HMRC AML, ICO). No more take-our-word-for-it.',
      },
      {
        emoji: '🙋',
        text: '**Anthony’s face is on the page** — "Software does the maths. A person makes the promise."',
      },
      {
        emoji: '📖',
        text: 'New **/probate guide** for executors — six plain-English steps, the two deadlines that bite, and where we honestly fit (and don’t).',
      },
      {
        emoji: '📍',
        text: 'Agents get the **live-timeline story** — one link, seller, agent and solicitor all see the same page.',
      },
      {
        emoji: '🚫',
        text: 'The old **£1,000 walk-away cover is retired everywhere** — offer PDF, emails, docs — matching the July terms review.',
      },
      {
        emoji: '🚪',
        text: 'The **front door is fixed** — typing the bare domain now lands sellers on the seller page, not the agent pitch. Full UX review in `docs/UX-REVIEW-2026-08.md`.',
      },
      {
        emoji: '🔏',
        text: 'A real **privacy notice** now lives at /legal/privacy — the ICO claim finally has the page to back it up.',
      },
    ],
  },
  {
    id: '2026-07-30-dashboard-wears-kept',
    date: '2026-07-30',
    emoji: '🌿',
    title: 'Your dashboard wears Kept. now too',
    intro: 'The last room in the house got painted. Cream walls, forest ink, leaf buttons.',
    bullets: [
      {
        emoji: '🎨',
        text: 'The whole dashboard is on the **Kept palette** — same rules as the site: **leaf** for actions, **wax** only for the dot.',
      },
      {
        emoji: '✒️',
        text: 'The sidebar now carries the **kept.** wordmark on a deep forest rail.',
      },
      {
        emoji: '🌙',
        text: '**Dark mode** came along — forest-tinted, easy on late-night deal reviews.',
      },
      {
        emoji: '🏷️',
        text: 'Every page title and internal mention now says **Kept** — including two vendor-facing quote messages that were hiding in here.',
      },
    ],
  },
  {
    id: '2026-07-30-kept-is-live',
    date: '2026-07-30',
    emoji: '🎉',
    title: 'You said go — the company is now Kept.',
    intro: 'The name flipped today. The whole front door reads kept. — wax dot and all.',
    bullets: [
      {
        emoji: '✍️',
        text: 'The public site, the offer letter and the emails now all say **Kept** — the three old name variants are gone in one move.',
      },
      {
        emoji: '🌐',
        text: 'The site still lives at **bellwoodslane.co.uk** for now — the 301 to **wearekept.co.uk** stays off until the new domain and mailboxes are wired up.',
      },
      {
        emoji: '⏪',
        text: 'Instant rollback if ever needed: one env setting (`NEXT_PUBLIC_BRAND_PHASE=legacy`) brings Bellwoods back — no code change.',
      },
    ],
  },
  {
    id: '2026-07-29-kept-brand-ready',
    date: '2026-07-29',
    emoji: '🟢',
    title: 'Meet Kept. — the new brand, built and waiting',
    intro: 'A price given is a price kept. The whole front door now wears it.',
    bullets: [
      {
        emoji: '🟢',
        text: '**Leaf green** for every action, **wax red** kept only for the promise — the two-accent rule, enforced in the code.',
      },
      {
        emoji: '📄',
        text: 'The site, the offer letter and the emails are all re-skinned — **not one word of copy changed** (a build check proves it).',
      },
      {
        emoji: '🔒',
        text: "Public name stays **Bellwoods Lane** until the trademark clears. When you say go, it's **one setting** to flip.",
      },
      {
        emoji: '🎨',
        text: 'It all maps to the **Kept.** design project (claude.ai/design), so design and code stay one system.',
      },
    ],
  },
  {
    id: '2026-07-29-scout-picks-the-best',
    date: '2026-07-29',
    emoji: '🔦',
    title: 'The scout now picks the best — and tells you when it is blind',
    intro:
      'It was finding 180 properties a day and keeping the first 30. Not the best 30. The first 30.',
    bullets: [
      {
        emoji: '🏆',
        text: 'Every property found is now ranked before we spend a penny on it. You get the best 30, not a random 30.',
      },
      {
        emoji: '🆕',
        text: 'Your daily card now says how many leads are actually NEW. "30 found — 0 NEW" instead of pretending all 30 need review.',
      },
      {
        emoji: '⚖️',
        text: 'Leads are no longer judged on data we have not bought yet. A missing price history used to quietly sink a good lead.',
      },
      {
        emoji: '🚨',
        text: 'New alert when a lead source goes dark — how many are still live, and exactly which key to set.',
      },
      {
        emoji: '🕳️',
        text: 'Heads up: 3 of your 4 distress sources are off right now. Open the alert, it lists the fix.',
      },
    ],
    cta: { label: 'Check your Action Centre', href: '/actions' },
  },
  {
    id: '2026-07-23-voice-notes-and-learning',
    date: '2026-07-23',
    emoji: '🎙️',
    title: 'Your scout now learns from your voice',
    intro: 'Big one. The platform just got ears — and a memory.',
    bullets: [
      {
        emoji: '🎙️',
        text: 'Tap the mic when rating a lead. Say what you like or dislike — it types itself.',
      },
      {
        emoji: '🧠',
        text: 'Every note is mined into your Taste Profile — what you love, what you hate, in your own words.',
      },
      {
        emoji: '🚫',
        text: 'Say "never buy next to a railway" once — the scout screens every future lead against it. Automatically.',
      },
      {
        emoji: '🎯',
        text: 'The calibration page now suggests scorer tweaks with one-click Apply. The more you talk, the sharper it gets.',
      },
    ],
    cta: { label: 'See your Taste Profile', href: '/leads/calibration' },
  },
];

export function latestWhatsNew(): WhatsNewEntry | null {
  return WHATS_NEW[0] ?? null;
}
