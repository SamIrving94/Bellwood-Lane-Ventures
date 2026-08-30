/**
 * October launch checklist — the task definitions behind /launch.
 *
 * Designed for an ADHD-friendly loop: the page shows ONE current task per
 * person ("do this now"), with literal numbered steps, a copyable command
 * where one exists, and a single Done button. Definitions live here in
 * code (same pattern as whats-new and the strategy proposals); only the
 * ticked state lives in the database, so shipping a new task is a commit.
 *
 * Writing rules for tasks:
 *  - Title = the outcome, five words or fewer.
 *  - `why` = one sentence, no jargon, no references to other lists.
 *  - Steps are LITERAL: open this, click this, paste this. A step a
 *    stranger couldn't follow is too vague.
 *  - `blockedBy` hides a task from "do this now" until its blockers are
 *    ticked — nobody is shown a task they cannot actually do.
 */

export type LaunchOwner = 'sam' | 'ant' | 'claude';

export type LaunchTask = {
  /** Stable id — ticked state is keyed on this. Never reuse one. */
  id: string;
  owner: LaunchOwner;
  title: string;
  /** One plain sentence: why this matters. */
  why: string;
  /** Literal, numbered steps. */
  steps: string[];
  /** Copyable terminal command, when one exists. */
  command?: string;
  /** One helpful link, when one exists. */
  href?: string;
  hrefLabel?: string;
  /** Task ids that must be done first. */
  blockedBy?: string[];
};

export const LAUNCH_TASKS: LaunchTask[] = [
  // ── SAM ────────────────────────────────────────────────────────────────
  {
    id: 'sam-merge-pr',
    owner: 'sam',
    title: 'Merge the code',
    why: 'Everything built this week (Keyhole, the trial, this page) goes live when this merges.',
    steps: [
      'Open the pull request (button below).',
      'Click "Ready for review".',
      'Click "Merge pull request", then "Confirm".',
    ],
    href: 'https://github.com/SamIrving94/Bellwood-Lane-Ventures/pull/94',
    hrefLabel: 'Open PR #94',
  },
  {
    id: 'sam-epc-token',
    owner: 'sam',
    title: 'Add the EPC key',
    why: 'Without it, Keyhole reports show no energy data and the district measuring tool cannot run.',
    steps: [
      'First check the bellwood-api project in Vercel: Settings → Environment Variables. If EPC_API_TOKEN is there, copy its value and skip to step 4.',
      'Otherwise: open get-energy-performance-data.communities.gov.uk and sign in with GOV.UK One Login (create one if needed).',
      'Go to "My account" and copy the API token.',
      'In Vercel, open the project that serves the public site (apps/web) → Settings → Environment Variables → add EPC_API_TOKEN, paste the value, save for Production and Preview.',
      'Also paste it into the .env file at the top of the repo on your laptop, as a line: EPC_API_TOKEN=your-token',
    ],
    href: 'https://get-energy-performance-data.communities.gov.uk/',
    hrefLabel: 'EPC data service',
  },
  {
    id: 'sam-migrate',
    owner: 'sam',
    title: 'Create the new database table',
    why: 'Keyhole saves reports to a table that does not exist in the live database yet.',
    steps: [
      'Open Terminal on your laptop.',
      'Go to the repo folder (cd into it).',
      'Run: git checkout master',
      'Run: git pull',
      'Paste the command below and press enter.',
      'Wait for it to say the push succeeded. Done.',
    ],
    command: 'pnpm migrate',
    blockedBy: ['sam-merge-pr'],
  },
  {
    id: 'sam-seed-fringe',
    owner: 'sam',
    title: 'Switch on the W11+NW3 trial',
    why: 'The scout cannot find Notting Hill or Hampstead stock until these two districts are switched on.',
    steps: [
      'In Terminal, in the repo folder, paste the command below (this is a practice run — it changes nothing).',
      'Check it says it resolved 2 districts (W11 and NW3).',
      'Run it again with --write added at the end.',
      'Open the dashboard → Settings → Scouting → click "Run scout now".',
    ],
    command: 'pnpm tsx scripts/seed-london-prime.mts --districts=W11,NW3',
    blockedBy: ['sam-merge-pr'],
  },
  {
    id: 'sam-arbitrage-csv',
    owner: 'sam',
    title: 'Run the truth machine',
    why: 'It measures which districts really have the refurb profit gap. It creates a file called arbitrage.csv — send that file to Claude and the district list gets re-ranked on evidence.',
    steps: [
      'Make sure the EPC key task is done first (the command refuses to run without it).',
      'In Terminal, in the repo folder, paste the command below. It takes a while — leave it running.',
      'When it finishes, a file called arbitrage.csv appears in the repo folder.',
      'Send that file to Claude in chat. That is the whole task.',
    ],
    command:
      'pnpm tsx --env-file=.env scripts/arbitrage-rank.mts --districts=SE22,SW12,W11,NW3 --csv=arbitrage.csv',
    blockedBy: ['sam-merge-pr', 'sam-epc-token'],
  },
  {
    id: 'sam-deals-mailbox',
    owner: 'sam',
    title: 'Check deals@ receives email',
    why: 'Keyhole referrals are sent to deals@wearekept.co.uk. If that mailbox does not exist, real leads vanish silently.',
    steps: [
      'Send a test email from your personal account to deals@wearekept.co.uk.',
      'Confirm it arrives somewhere you and Ant actually read.',
      'If it bounces: add deals@ as an alias in the email admin, then test again.',
    ],
  },
  {
    id: 'sam-pilot-list',
    owner: 'sam',
    title: 'Pick 8 pilot solicitors',
    why: 'Keyhole needs 5-8 friendly professionals to test it. Local firms in our own postcodes, not City firms.',
    steps: [
      'Open Google Maps.',
      'Search "probate solicitor" in each of: Balham, East Dulwich, Walthamstow, Crouch End.',
      'Prefer small firms (1-5 partners) with a named probate person.',
      'Write down 8: firm, person, email. Anywhere is fine — notes app, spreadsheet.',
      'Do NOT contact them yet. Claude drafts the invitation email; you approve it first.',
    ],
    blockedBy: ['sam-merge-pr'],
  },
  {
    id: 'sam-first-look',
    owner: 'sam',
    title: 'Start the first-look agent list',
    why: 'Buying agents are starving for off-market stock. Giving 3 of them first look at our refurbished exits earns their surplus leads back.',
    steps: [
      'Open the playbook (button below) and read it once — 3 minutes.',
      'Write down 3 buy-side agents you already know or can get introduced to.',
      'Add them to the same notes/sheet as the solicitors.',
      'No outreach yet — this list feeds the relationship work after launch scope is agreed.',
    ],
    href: 'https://github.com/SamIrving94/Bellwood-Lane-Ventures/blob/master/docs/templates/buying-agent-first-look.md',
    hrefLabel: 'Open the playbook',
  },
  {
    id: 'sam-credits-check',
    owner: 'sam',
    title: 'Glance at PropertyData credits',
    why: 'The W11+NW3 trial adds roughly two extra scans per run. One look confirms the plan can afford it.',
    steps: [
      'After the scout has run twice with the new districts, log in to PropertyData.',
      'Open the account usage page.',
      'If usage is under ~80% of the monthly allowance, tick this and move on. If not, tell Claude and the trial gets capped.',
    ],
    blockedBy: ['sam-seed-fringe'],
  },
  {
    id: 'sam-hire-freelancer',
    owner: 'sam',
    title: 'Hire the PPC freelancer',
    why: 'Someone has to run the Google Ads plan. The brief is written; you shortlist, call, and pick.',
    steps: [
      'Agree launch scope with Ant first (his list has the same task).',
      'Open the brief (button below). Read it once.',
      'Post it in two places the same day (the brief says exactly where and what to write).',
      'Book 15-minute calls with the 3 best replies.',
      'Ask the 5 screening questions at the bottom of the brief. Score each answer 1-3.',
      'Hire the top scorer for a 30-day sprint. Do not sign anything longer.',
    ],
    href: 'https://github.com/SamIrving94/Bellwood-Lane-Ventures/blob/master/docs/marketing/freelancer-brief-ppc.md',
    hrefLabel: 'Open the brief',
    blockedBy: ['ant-launch-scope'],
  },

  // ── ANT ────────────────────────────────────────────────────────────────
  {
    id: 'ant-launch-scope',
    owner: 'ant',
    title: 'Agree launch scope with Sam',
    why: 'One decision shapes the whole month: go loud with paid ads in October, or lead with the professional pilots and run a small paid test behind them.',
    steps: [
      'Option A: paid ads live at £1,000/month from launch (the marketing plan is ready).',
      'Option B: pilots and relationships lead; a £250-£500 paid test runs quietly to learn the cost per lead first.',
      'The honest case for B: we have no public reviews yet, and ads convert on trust we have not built. The case for A: probate searches are high intent and our promise is different.',
      'Talk to Sam. Pick one on purpose. Tick when picked.',
    ],
  },
  {
    id: 'ant-module-vote',
    owner: 'ant',
    title: 'Pick the next tool to build',
    why: 'Claude is ready to build the next professional tool and is waiting only on this pick.',
    steps: [
      'Option 1 — Vacancy guard: reminders that stop an empty estate property becoming uninsured (executors are personally liable). Recommended: sharpest pain, most reuse.',
      'Option 2 — IHT timeline: maps the tax deadline against the probate timeline and shows the funding gap.',
      'Tell Sam or reply on the Strategy page. Tick when told.',
    ],
  },
  {
    id: 'ant-firewall',
    owner: 'ant',
    title: 'Sign off the integrity firewall',
    why: 'The professional tools will hold solicitors’ case data. The rule: their data is never used to target properties. One breach kills the whole strategy.',
    steps: [
      'Read the firewall paragraph in the shelf doc (button below) — 1 minute.',
      'If you agree, tick. If not, say what should change.',
    ],
    href: 'https://github.com/SamIrving94/Bellwood-Lane-Ventures/blob/master/docs/proposals/keyhole-probate-shelf-tree.md',
    hrefLabel: 'Open the shelf doc',
  },
  {
    id: 'ant-funding-veto',
    owner: 'ant',
    title: 'Confirm the IHT-funding veto',
    why: 'One researched idea — lending estates money in exchange for first-look purchase rights — was vetoed: it is a conflict a court would feast on, and sits on the FCA lending perimeter.',
    steps: [
      'Confirm the veto stands: we may signpost independent probate lenders, never lend with strings, never for purchase rights.',
      'Tick to confirm.',
    ],
  },
  {
    id: 'ant-kill-gate',
    owner: 'ant',
    title: 'Agree the pilot kill-gate',
    why: 'The Keyhole pilot must prove itself or stop: the proposed bar is 1 referred lead AND 1 completed deal within 12 weeks of the pilot starting.',
    steps: ['Agree the bar, or propose a different one. Tick when settled.'],
  },
  {
    id: 'ant-compliance-opinion',
    owner: 'ant',
    title: 'Commission the compliance opinion',
    why: 'Blocks paying any referral fee and blocks legal claims in marketing copy. Opinions take weeks — starting now is what makes October possible.',
    steps: [
      'Pick a regulatory solicitor (or ask our conveyancing contact for a referral).',
      'Send the scope, in one line each: (1) can solicitors and RICS surveyors accept referral fees from us and on what disclosure terms, (2) which legal claims may our professional tools make about executor duties, (3) where is the FCA line on illustrating bridging costs and signposting lenders.',
      'Ask for a 2-3 week turnaround and a fixed fee. Tick when instructed.',
    ],
  },
  {
    id: 'ant-sdlt',
    owner: 'ant',
    title: 'SDLT structure with the accountant',
    why: 'A company buying a £2M house pays £300k flat SDLT unless the developer/trader relief is structured correctly. This must be settled before the first big purchase.',
    steps: [
      'Book the accountant.',
      'Ask: how do we qualify for property-developer/trader relief on buy-refurbish-sell purchases, and what records must each deal keep?',
      'Get it in writing. Tick when the answer is on file.',
    ],
  },
  {
    id: 'ant-bridging',
    owner: 'ant',
    title: 'Line up bridging under 60% LTV',
    why: 'Below 60% loan-to-value, bridging costs roughly 0.55-0.75% a month. Above it, up to double. On a 9-month hold that difference is real margin.',
    steps: [
      'Ask 2 brokers for indicative terms at sub-60% LTV on London period houses.',
      'Compare monthly rate plus arrangement fee, not just the headline.',
      'Tick when a facility or named lender relationship is agreed in principle.',
    ],
  },
  {
    id: 'ant-eig',
    owner: 'ant',
    title: 'Decide the EIG subscription',
    why: 'A £30/month feed of auction lots that FAILED to sell — the most pre-qualified motivated sellers there are. The proposal has been open since May. Yes or no, either is fine.',
    steps: [
      'Read the one-page proposal (button below).',
      'Tell Sam yes or no. Tick when decided.',
    ],
    href: 'https://github.com/SamIrving94/Bellwood-Lane-Ventures/blob/master/docs/proposals/eig-subscription.md',
    hrefLabel: 'Open the proposal',
  },

  // ── CLAUDE ─────────────────────────────────────────────────────────────
  {
    id: 'claude-freelancer-brief',
    owner: 'claude',
    title: 'Write the freelancer brief',
    why: 'The one-page brief Sam posts to hire the PPC freelancer: scope, budget, the 4 numbers, guardrails, screening questions.',
    steps: ['Written and in the repo: docs/marketing/freelancer-brief-ppc.md.'],
  },
  {
    id: 'claude-pilot-email',
    owner: 'claude',
    title: 'Draft the pilot invitation email',
    why: 'The founder-sent note inviting the 8 solicitors to try Keyhole. Kept voice, no sales push.',
    steps: ['Waiting on Sam’s word to draft it.'],
    blockedBy: ['sam-pilot-list'],
  },
  {
    id: 'claude-tier-badge',
    owner: 'claude',
    title: 'Build the cornerstone badge',
    why: 'Marks £1.5M+ prime leads so the founder glance can triage the big-ticket book first.',
    steps: ['Queued — ships with the next code block.'],
  },
  {
    id: 'claude-next-module',
    owner: 'claude',
    title: 'Build the next professional tool',
    why: 'Vacancy guard or IHT timeline — whichever Ant picks.',
    steps: ['Waiting on Ant’s pick.'],
    blockedBy: ['ant-module-vote'],
  },
  {
    id: 'claude-retier',
    owner: 'claude',
    title: 'Re-rank the district list',
    why: 'Turns the arbitrage.csv evidence into keep/cut/re-tier decisions on the 33 districts.',
    steps: ['Waiting on the arbitrage.csv file from Sam.'],
    blockedBy: ['sam-arbitrage-csv'],
  },
];

/** Setting row that stores { [taskId]: { doneAt: string, by: string } }. */
export const LAUNCH_CHECKLIST_SETTING_KEY = 'launch.checklist';

export const OWNER_LABELS: Record<LaunchOwner, string> = {
  sam: 'Sam',
  ant: 'Ant',
  claude: 'Claude',
};
