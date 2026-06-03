/**
 * Tour definitions for driver.js.
 *
 * Pure data, no React. Each tour is an array of steps the launcher feeds
 * straight into `driver({ steps })`. Add a new tour by appending an entry
 * to TOURS; the launcher and /guide cards pick it up automatically as
 * long as the id is wired into TOUR_META below.
 *
 * Voice rules (the founder is dyslexic):
 *   - UK English.
 *   - ~30 words per step, short sentences, no jargon, no emoji.
 *   - Explain what the section is FOR, not what is on the page.
 */

export type TourStep = {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
};

export type TourId = 'onboarding' | 'today' | 'appraisals' | 'marketing';

export const TOURS: Record<TourId, TourStep[]> = {
  // ─────────────────────────────────────────────────────────────────────
  // Onboarding — full sidebar walk-through. Default tour from /guide.
  // ─────────────────────────────────────────────────────────────────────
  onboarding: [
    {
      element: '[data-tour="sidebar-today"]',
      popover: {
        title: 'Today',
        description:
          'Your daily start. Shows decisions waiting on you and the best leads found overnight. Open this first each morning.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-quotes"]',
      popover: {
        title: 'Quotes',
        description:
          'Agent quick-form submissions. Each carries a four-hour signed offer SLA, so the clock here drives the day.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-leads"]',
      popover: {
        title: 'Leads',
        description:
          'Every probate, chain break or repossession the scout surfaced. Each lead has a score and a verdict you can act on.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-appraisals"]',
      popover: {
        title: 'Appraisals',
        description:
          'Deep, structured valuations. Strong leads land here at 08:30 with comparables, ARV, environmental risks and a bid cap.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-pipeline"]',
      popover: {
        title: 'Pipeline',
        description:
          'Every live deal, grouped by stage. This is the core of the business and where deals move from offer to completion.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-book"]',
      popover: {
        title: 'Book',
        description:
          'The trade track record. Every deal you have bought, with realised profit, blended ROI and capital deployed.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-investors"]',
      popover: {
        title: 'Investors',
        description:
          'Deals we have passed on and released. Share read-only access links, log interest and track sourcing fees.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-research"]',
      popover: {
        title: 'Research',
        description:
          'Concierge for postcodes, agents and deals. Ask it anything; it pulls the data the rest of the app uses.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-marketing"]',
      popover: {
        title: 'Marketing',
        description:
          'Drafts waiting for approval. Instagram, LinkedIn and blog posts queue up here, gated by the thirty-day anonymisation rule.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-outreach"]',
      popover: {
        title: 'Outreach',
        description:
          'Targeted campaigns, the reply inbox and templates. The home for proactive contact with sellers and partners.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-documents"]',
      popover: {
        title: 'Documents',
        description:
          'Probate, lease and contract reviews. Drop a file in and the pipeline extracts the key points for you.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="sidebar-guide"]',
      popover: {
        title: 'Guide',
        description:
          'You are here. Launch any tour again from this page. New tours land here as the app grows.',
        side: 'right',
        align: 'start',
      },
    },
  ],

  // ─────────────────────────────────────────────────────────────────────
  // Today — what the action queue and headline stats mean.
  // ─────────────────────────────────────────────────────────────────────
  today: [
    {
      element: '[data-tour="action-list"]',
      popover: {
        title: 'Needs your decision',
        description:
          'The single queue of things only you can decide. Agent SLAs sit at the top because their four-hour clock breaches first.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="stat-pending"]',
      popover: {
        title: 'Quote submissions',
        description:
          'How many agent quick-form quotes landed in the last twenty-four hours. Each one starts a four-hour signed offer clock.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="stat-overdue"]',
      popover: {
        title: 'New leads',
        description:
          'Scouted opportunities added in the last twenty-four hours. The strong ones are deep-appraised automatically at 08:30.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="stat-revenue"]',
      popover: {
        title: 'Outreach replies',
        description:
          'Replies to outbound campaigns in the last day. Open the Outreach inbox to read and respond to each one.',
        side: 'bottom',
        align: 'center',
      },
    },
  ],

  // ─────────────────────────────────────────────────────────────────────
  // Appraisals — the nine-section deep appraisal layout.
  // ─────────────────────────────────────────────────────────────────────
  appraisals: [
    {
      element: '[data-tour="appraisal-header"]',
      popover: {
        title: 'Verdict at a glance',
        description:
          'Bid, walk, bid with caveats or further investigation. The headline is the one-line reason for the call.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="appraisal-arv"]',
      popover: {
        title: 'After-repair value',
        description:
          'The point estimate plus the eighty percent confidence band. The hard cap is the most we will pay under any scenario.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="appraisal-comparables"]',
      popover: {
        title: 'Comparables',
        description:
          'Recent sales used to anchor the ARV. The row marked BEST is the cleanest match on size, type and date.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="appraisal-environment"]',
      popover: {
        title: 'Environmental risk',
        description:
          'Coal mining, radon, flood, knotweed and noise. Material risks feed straight into the bid cap discount stack.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="appraisal-escalations"]',
      popover: {
        title: 'Confidence and escalations',
        description:
          'The estimated error band and anything the model wants you to look at by hand before bidding.',
        side: 'left',
        align: 'start',
      },
    },
  ],

  // ─────────────────────────────────────────────────────────────────────
  // Marketing — the queue, the gate, and the calendar.
  // ─────────────────────────────────────────────────────────────────────
  marketing: [
    {
      element: '[data-tour="marketing-tab-queue"]',
      popover: {
        title: 'Queue',
        description:
          'Drafts waiting for your approval. Instagram, LinkedIn, blog and paid ads all funnel here before they go live.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="marketing-queue-row"]',
      popover: {
        title: 'One draft, one decision',
        description:
          'Expand a row to read the caption or body. Approve to schedule it, dismiss to drop it.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="marketing-anonymisation"]',
      popover: {
        title: 'Anonymisation gate',
        description:
          'A draft tied to a recent deal is locked until thirty days after completion. The badge shows when it unlocks.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="marketing-tab-calendar"]',
      popover: {
        title: 'Calendar',
        description:
          'Approved posts laid out by date. Use it to spot gaps and to confirm what is scheduled to publish next.',
        side: 'bottom',
        align: 'start',
      },
    },
  ],
};

/**
 * Display metadata for the /guide tour-index cards. Kept here so the data
 * file owns both the steps and the marketing copy for them.
 */
export const TOUR_META: Record<
  TourId,
  { title: string; description: string }
> = {
  onboarding: {
    title: 'Onboarding',
    description: 'A guided walk through every section in the sidebar.',
  },
  today: {
    title: 'Today',
    description: 'How the action queue, SLAs and overnight leads fit together.',
  },
  appraisals: {
    title: 'Appraisals',
    description: 'The nine sections of a deep appraisal, explained.',
  },
  marketing: {
    title: 'Marketing',
    description: 'How the draft queue, anonymisation gate and calendar work.',
  },
};

/**
 * Map a pathname to the tour that fits it. Used by the topbar button so
 * a click on /appraisals fires the appraisals tour, /marketing fires the
 * marketing tour, etc. Everything else falls back to onboarding.
 */
export function tourIdForPath(pathname: string): TourId {
  if (pathname.startsWith('/appraisals')) return 'appraisals';
  if (pathname.startsWith('/marketing')) return 'marketing';
  if (pathname === '/') return 'today';
  return 'onboarding';
}
