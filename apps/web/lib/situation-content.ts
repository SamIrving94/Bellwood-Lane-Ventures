import type { SituationValue } from '@/lib/situations';

/**
 * Content for the four situation landing pages (probate, chain-break,
 * separation, relocation), verbatim from the Aug 2026 design handoff's
 * reason-page template. The copy is signed off; do not paraphrase.
 *
 * One deliberate normalisation, flagged at implementation: the handoff's
 * homepage carries the NEWER promise chain (offer confirmed within two
 * working days of viewing, held for a week) while this template predated
 * it, so every 72-hour / 24–48-hour string here is aligned to the homepage
 * promise. The backend lock in packages/instant-offer matches.
 */

export type SituationKey =
  | 'probate'
  | 'chain-break'
  | 'separation'
  | 'relocation';

export type SituationContent = {
  /** Quote-intake situation value submitted with the form. */
  situation: SituationValue;
  /** Human trigger label stored alongside the intake. */
  triggerLabel: string;
  /** Show the threshold photograph under the hero copy. */
  photo?: boolean;
  eyebrow: string;
  h1a: string;
  h1b: string;
  sub: string;
  disclaimer?: string;
  fitTitle: string;
  fitBody: string;
  cards: Array<{ t: string; d: string }>;
  stepsEyebrow: string;
  stepsTitle: string;
  steps: Array<{ n: string; t: string; d: string }>;
  qaTitle: string;
  faqs: Array<{ q: string; a: string }>;
  honestTitle: string;
  honestBody: string;
  ctaLabel: string;
  mobileNote: string;
};

const FEE_A =
  'There is no agent fee and no fee to us, at any point. You instruct your own solicitor and pay their costs; we pay ours. The figure in our offer is the figure we complete at, minus your own legal costs.';
const BELOW_A =
  'Because we buy for cash, complete in weeks rather than months, charge no fee, and carry the risk of the sale falling through. The price reflects the speed and the certainty of the transaction.';
const SPEED_A =
  'At the pace you need. We can complete in as little as two weeks, or take as long as your circumstances require if you are waiting on a grant of probate, a court date, or an onward purchase. We instruct solicitors as soon as you accept and share proof of funds straight away.';
const CHANGE_A =
  'The price we confirm in writing is the price we complete at. There are only three exceptions, all documented in writing: (1) a structural survey reveals a material defect that was not visible or disclosed at viewing, (2) a title issue emerges during conveyancing that materially affects value, or (3) information provided about the property turns out to be materially incorrect. None of those apply? The price does not change.';
const MIND_A =
  'Yes. The offer is binding upon Kept for a week. It is not binding upon you until exchange of contracts. You can withdraw at any point before exchange at no cost.';
const REG_A =
  'Cash property buying is unregulated by the FCA. We are members of the Property Redress Scheme (PRS), a government-approved independent redress body. We voluntarily follow The Property Ombudsman code, are HMRC-registered for AML supervision, and ICO-registered as a data controller.';

const KEPT_STEPS: SituationContent['steps'] = [
  {
    n: '01',
    t: 'You get in touch',
    d: 'Tell us the address and a little about your situation. We come back to you the same day. Before we bother you for anything else, we pull what we can ourselves: Land Registry, EPC, planning.',
  },
  {
    n: '02',
    t: 'We come and see the property',
    d: 'We view every property before we price it. We tell you in advance what we are looking for, so there is nothing to prepare and nothing to dread.',
  },
  {
    n: '03',
    t: 'Our offer, in writing',
    d: 'The price we send is the price we complete at. We share the notes that informed it. Held for a week, so you can take advice and talk it over with whoever you need to.',
  },
  {
    n: '04',
    t: 'Conveyancing and completion',
    d: 'You instruct your own solicitor, and we can recommend firms used to working quickly. We instruct ours straight away. Regular updates on a live timeline you can share with anyone. We pay our own legal costs.',
  },
];

export const SITUATION_CONTENT: Record<SituationKey, SituationContent> = {
  probate: {
    situation: 'probate',
    triggerLabel: 'Probate',
    eyebrow: 'a guide for executors',
    h1a: 'Probate,',
    h1b: 'in plain English.',
    sub: 'You have lost someone, and now there is a house to deal with as well. This page sets out what happens next: the steps in the order they come, the two dates that genuinely matter, and where selling fits. Nothing here needs doing today. And if you would rather talk it through than read it, Anthony answers himself, the same day.',
    disclaimer:
      'This is general information, not legal or tax advice. For the estate’s specific position, speak to a solicitor.',
    fitTitle: 'Agree the price now. Complete on the grant date.',
    fitBody:
      'Because completion has to wait for the grant anyway, the waiting costs you nothing with us. We come and view the property, confirm the price in writing, and set completion for the day the grant arrives. It becomes one less thing to think about while you deal with everything else.',
    cards: [
      {
        t: 'Price certainty',
        d: 'Confirmed in writing after viewing, locked for a week, and it does not change at the last minute. Executors can put a real number in front of beneficiaries.',
      },
      {
        t: 'No chain',
        d: 'Cash, no mortgage condition, no onward chain to collapse. The fall-through risk that haunts probate sales is removed.',
      },
      {
        t: 'No fees to the estate',
        d: 'No agent fee, and no fee to us. The estate instructs its own solicitor and pays their costs; we pay ours.',
      },
    ],
    stepsEyebrow: 'what happens, in order',
    stepsTitle: 'Six steps, in the order they happen.',
    steps: [
      {
        n: '01',
        t: 'Register the death',
        d: 'Within 5 days in England and Wales. The register office gives you certified copies of the death certificate. Order several, because banks, insurers and the probate registry all want their own.',
      },
      {
        n: '02',
        t: 'Find the will, or apply the intestacy rules',
        d: 'The will names the executors, the people legally responsible for the estate. If there is no will, the intestacy rules decide who inherits and who can act (an "administrator" rather than an executor).',
      },
      {
        n: '03',
        t: 'Value the estate for inheritance tax',
        d: 'Everything the person owned, including the property, valued at the date of death. Inheritance tax is due by the end of the sixth month after the death. A solicitor or probate specialist will walk you through this part. It is the bit most executors would rather not do alone.',
      },
      {
        n: '04',
        t: 'Apply for the grant of probate',
        d: 'The grant is the legal document that lets executors deal with the estate. You can apply online or by post. It typically takes months, not weeks, to arrive, and nothing can complete without it.',
      },
      {
        n: '05',
        t: 'Look after the property while you wait',
        d: 'An empty home still needs looking after: council tax, utilities, the garden, the post. One practical thing people miss: tell the insurer, because standard home insurance often lapses once a property has been empty for 30 to 60 days.',
      },
      {
        n: '06',
        t: 'Sell or transfer the property',
        d: 'You can market the property and agree a sale before the grant arrives. You just cannot complete until it does. Most probate sales sit waiting in that gap.',
      },
    ],
    qaTitle: 'Questions executors ask us.',
    faqs: [
      {
        q: 'Can we agree a sale before the grant of probate?',
        a: 'Yes. You can market the property, receive offers and agree a price at any point. Completion, meaning money and keys changing hands, has to wait for the grant. We routinely agree a price early and set completion for the grant date.',
      },
      {
        q: 'Do all the executors have to agree?',
        a: 'Yes. Every named executor who takes up the role must sign. If beneficiaries disagree about the route, speed versus best price, resolve that first. We would rather wait than sit inside a family dispute.',
      },
      {
        q: 'What does using Kept cost the estate?',
        a: 'There is no agent fee, and no fee to us at any point. The estate instructs its own solicitor and pays their costs; we pay ours, along with our searches and survey.',
      },
      { q: 'Why is the offer below open-market?', a: BELOW_A },
    ],
    honestTitle: 'A cash sale is not right for every estate.',
    honestBody:
      'If the estate is under no time pressure, the property is in good condition, and the beneficiaries want every pound of value, a good local agent on the open market will very likely net more. We would rather say so than waste your time.',
    ctaLabel: 'Talk to us about the property',
    mobileNote: 'No fees to the estate',
  },
  'chain-break': {
    situation: 'chain_break',
    triggerLabel: 'Chain break',
    photo: true,
    eyebrow: 'for sellers whose buyer pulled out',
    h1a: 'Your buyer pulled out.',
    h1b: 'The chain doesn’t have to break.',
    sub: 'Months of work, undone weeks from the finish. Tell us the address today. We view the property, then we confirm an offer in writing within two working days of that viewing, and the price we write down is the price we complete at.',
    fitTitle: 'We step in where your buyer stepped out.',
    fitBody:
      'Roughly a third of agreed sales in England and Wales never reach completion. When yours is one of them, the question is no longer what the house is worth in six months, it is whether your onward move survives the next three weeks.',
    cards: [
      {
        t: 'No chain to collapse',
        d: 'Cash, no mortgage condition, no onward buyer behind us. The risk that just cost you this sale is the one thing we remove.',
      },
      {
        t: 'Your onward purchase survives',
        d: 'We can complete in as little as two weeks, so the house you are buying does not go back on the market while you start again.',
      },
      {
        t: 'No fees, and you can still walk',
        d: 'No agent fee and no fee to us at any point. You can withdraw at any time before exchange, at no cost.',
      },
    ],
    stepsEyebrow: 'how it works',
    stepsTitle: 'Four steps. No surprises.',
    steps: KEPT_STEPS,
    qaTitle: 'Questions sellers ask us.',
    faqs: [
      { q: 'How quickly can you complete?', a: SPEED_A },
      { q: 'Why is the offer below open-market?', a: BELOW_A },
      { q: 'Can the offer change later?', a: CHANGE_A },
      { q: 'What does it cost me?', a: FEE_A },
    ],
    honestTitle: 'If you can wait, waiting will pay you more.',
    honestBody:
      'If your onward purchase is safe and you can put the house back on the market for a few more months, the open market will almost certainly get you a better price. Speed is the trade you are paying for with us.',
    ctaLabel: 'Get my offer',
    mobileNote: 'Same-day response',
  },
  separation: {
    situation: 'other',
    triggerLabel: 'Separation',
    eyebrow: 'for separating couples',
    h1a: 'A clean break,',
    h1b: 'on a date you both know.',
    sub: 'Court-ordered timelines, a joint mortgage to clear, and a house neither of you wants to keep showing to strangers. We view once, put the price in writing, and complete when the paperwork allows. Solicitors talk to solicitors.',
    fitTitle: 'One viewing, one price, one date.',
    fitBody:
      'Selling on the open market during a separation means months of viewings, two sets of expectations, and a price that can move at the last minute. We move quietly and quickly, and everything we agree is in writing from the start.',
    cards: [
      {
        t: 'One viewing, not forty',
        d: 'We view the property once. No open days, no stream of strangers through a house one of you may still be living in.',
      },
      {
        t: 'A date you can hold us to',
        d: 'The price is confirmed in writing and held for a week. We do not renegotiate between offer and exchange.',
      },
      {
        t: 'No fees to split',
        d: 'No agent fee and no fee to us at any point. You each instruct your own solicitor and pay their costs; we pay ours.',
      },
    ],
    stepsEyebrow: 'how it works',
    stepsTitle: 'Four steps. No surprises.',
    steps: KEPT_STEPS,
    qaTitle: 'Questions sellers ask us.',
    faqs: [
      { q: 'What does it cost me?', a: FEE_A },
      { q: 'Can I change my mind after I accept?', a: MIND_A },
      { q: 'How quickly can you complete?', a: SPEED_A },
      { q: 'Are you regulated?', a: REG_A },
    ],
    honestTitle: 'If the goal is the highest possible price, say so.',
    honestBody:
      'Our offer is below open-market value by design. If both of you want to maximise every pound and you can live with the wait and the viewings, a good local agent is the better route, and we will tell you that on the phone.',
    ctaLabel: 'Get my offer',
    mobileNote: 'Solicitor to solicitor',
  },
  relocation: {
    situation: 'relocation',
    triggerLabel: 'Relocation',
    photo: true,
    eyebrow: 'for sellers moving away',
    h1a: 'Sign once.',
    h1b: 'Complete from anywhere.',
    sub: 'Signatures across time zones, an empty house behind you, and a life starting somewhere else. We view the property, confirm the price in writing, and complete on the date that suits the move rather than the market.',
    fitTitle: 'The house stops being the thing holding you up.',
    fitBody:
      'An empty property left on the market is viewings you cannot host, a chain you cannot manage from another country, and insurance that quietly lapses. We remove all three by buying it ourselves, on your date.',
    cards: [
      {
        t: 'Completion on your date',
        d: 'Fast when you need fast, in as little as two weeks. Patient when you are still waiting on somewhere to move to.',
      },
      {
        t: 'Nothing to host',
        d: 'One viewing by us, and no open days to run from a different time zone. We tell you in advance what we are looking for.',
      },
      {
        t: 'No fees, no chain',
        d: 'No agent fee and no fee to us. Cash, no mortgage condition, and no buyer behind us to fall away.',
      },
    ],
    stepsEyebrow: 'how it works',
    stepsTitle: 'Four steps. No surprises.',
    steps: KEPT_STEPS,
    qaTitle: 'Questions sellers ask us.',
    faqs: [
      { q: 'How quickly can you complete?', a: SPEED_A },
      { q: 'What does it cost me?', a: FEE_A },
      { q: 'Why is the offer below open-market?', a: BELOW_A },
      { q: 'Are you regulated?', a: REG_A },
    ],
    honestTitle: 'A good house in a good street sells itself.',
    honestBody:
      'If the property is in excellent condition and high demand, and your move can absorb a few months of chain risk, a good high-street agent will very likely net you more. That is their wedge, not ours.',
    ctaLabel: 'Get my offer',
    mobileNote: 'Same-day response',
  },
};
