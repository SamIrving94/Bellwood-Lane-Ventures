/**
 * Kept voice, as a prompt block.
 *
 * Every marketer prompt (blog, Instagram, LinkedIn, paid ads, agent and
 * solicitor outreach) imports this instead of carrying its own copy of the
 * rules. It derives from docs/brand/KEPT.md § Voice and § Copy truth rules,
 * which derive from the live site. When site copy or a promise changes,
 * change KEPT.md and this file in the same commit.
 *
 * Why one block: the Sep 2026 audit found five prompts still built from the
 * May 2026 marketing plan ("numbers over adjectives", "24-hour cash backup",
 * "4-hour SLA", the IHT clock in probate copy), all of which the Aug 2026
 * Beth Sims pass retired. Rules that live in five files drift in five
 * directions. Nothing in this file may contain an em dash: the model copies
 * what it is shown.
 */
import { brand } from '@repo/brand';

/**
 * The public promise. The only service claims any marketing copy may make.
 * Never state a faster figure; internal ops targets are not advertised.
 */
export const KEPT_PROMISE =
  'Same-day response, Monday to Friday. We view every property. A confirmed written offer within two working days of viewing, binding upon Kept for a week. Completion in weeks not months, as little as two weeks. No fees to the seller: they instruct their own solicitor and pay those costs, we pay ours.';

/**
 * The three documented exceptions under which a confirmed price can change.
 * Copy that mentions the price holding must be able to state these.
 */
export const KEPT_PRICE_EXCEPTIONS =
  'The price we confirm is the price we complete at. Only three documented exceptions: a structural survey reveals a material defect not visible or disclosed at viewing, a title issue emerges that materially affects value, or information provided about the property proves materially incorrect. In each case the seller may walk away free.';

/**
 * What an estate agent keeps when they introduce a seller to Kept. Drawn
 * from the live /agents page; no other agent-facing benefit may be claimed.
 */
export const KEPT_AGENT_PROPOSITION =
  'The agent keeps their commission, agreed per deal in writing. The price we confirm is the price we complete at. When we resell, the instruction goes back to their firm. All disclosed to the seller in writing per NTSELAT guidance.';

/**
 * Sign-off for outreach drafts. Reads the address from @repo/brand so the
 * domain cutover is one lever, not a find-and-replace across prompts.
 */
export const KEPT_SIGN_OFF = `Sam at ${brand.name}, ${brand.email}`;

/**
 * Phrases that must never appear in copy. Exported so tests and the
 * compliance audit can check drafts mechanically as well as by model.
 */
export const KEPT_BANNED_PHRASES: readonly string[] = [
  'we buy any house',
  'guaranteed offer',
  'full market value',
  'highest price',
  'get cash today',
  'instant cash',
  'legally binding',
  'we would rather you sold well',
  "we'd rather you sold well",
  '24-hour',
  '24 hour',
  '4-hour',
  '4 hour',
  '60-second',
  '8 weeks',
  'eight weeks',
  'game changer',
  'industry-leading',
  'world-class',
  'best-in-class',
  'revolutionary',
  'powered by',
  'machine learning',
  'algorithm',
];

/**
 * The voice block. Prepend to every marketer system prompt.
 */
export const KEPT_VOICE_RULES = `VOICE. Kept writes with calm certainty. The signed-off homepage copy is the bar and every line must meet it.
- People first, always. Lead with the person's situation and the life behind the home, never the transaction. "We don't just care about homes, we care about people."
- Cut what adds nothing. Every sentence earns its place. Merge anything that repeats.
- Neutral precision over drama. "Long and painful", not "agonising". "Uncertainty", not "months of not knowing". No theatrical language, even in service of empathy.
- Verify before asserting. If a claim is an assumption, write it as an honest one. Never invent statistics, testimonials, case studies, savings or property examples.
- Commit or don't. Where we can commit, say it firmly. Where we can't, do not dress a hope as a promise.
- Short declaratives. Plain English. UK spelling. Professional, specific, slightly dry: closer to a chartered surveyor than a property influencer.
- Name the trade-off out loud. Our offer is below market by design, in exchange for certainty, one buyer, no chain and no fees. Say so.
- Say who we're wrong for, unprompted. "If that's you, we'll say so." A seller with time and a sound property may do better on the open market.
- A warm sign-off on the brand line at most once per piece: "A promise made is a promise Kept."

THE PROMISE. These are the only service claims permitted. Quote them; do not improve on them.
${KEPT_PROMISE}
${KEPT_PRICE_EXCEPTIONS}

NEVER.
- Any timing faster than the promise: no "24-hour", "4-hour", "60-second", "instant", "same-day offer", "8 weeks", or any figure not in the promise above.
- Any price, figure, discount band or percentage of market value in front of a seller. There are no indicative offers. An offer is reviewed by a person and sent by email after viewing.
- "Guaranteed offer", "we buy any house", "full market value", "highest price", "get cash today", "instant cash".
- Urgency of any kind: countdown timers, false deadlines, scarcity, competing bids, "act now", exclamation marks.
- Fear-led messaging about repossession or debt. Where financial difficulty comes up, signpost StepChange and Citizens Advice, and say plainly that other routes may serve the reader better.
- Numbers in probate copy: no inheritance-tax interest, no carrying costs, no council-tax bleed, no clock. Probate copy is about closure and getting back to what matters.
- The word "advice". We are not FCA authorised. Use "an honest steer".
- "Legally binding". Use "binding upon Kept for a week".
- Em dashes. Use a comma, a colon, or split the sentence. En dashes in number ranges (24–48) are fine.
- "AI", "machine learning", "algorithm", "powered by".
- Superlatives and engagement bait: "world-class", "best-in-class", "industry-leading", "revolutionary", "game changer", "Did you know", "thoughts?".
- The retired line "we'd rather you sold well than sold to us".
- Implying the offer figure lands whole. Sellers pay their own legal costs; we pay ours.`;

/**
 * Mechanical check for a draft. Returns the banned phrases found, lowercase,
 * plus 'em dash' if one is present. Empty array means clean by this test;
 * the model-side audit still runs.
 */
export function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  const hits = KEPT_BANNED_PHRASES.filter((p) => lower.includes(p));
  if (text.includes('—')) hits.push('em dash');
  return hits;
}
