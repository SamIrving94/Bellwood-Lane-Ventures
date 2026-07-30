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
      {
        emoji: '💸',
        text: 'Bonus: leads that already went SSTC are caught before they waste credits.',
      },
    ],
    cta: { label: 'See your Taste Profile', href: '/leads/calibration' },
  },
];

export function latestWhatsNew(): WhatsNewEntry | null {
  return WHATS_NEW[0] ?? null;
}
