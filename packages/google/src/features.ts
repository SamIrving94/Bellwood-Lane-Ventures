import 'server-only';

import { database } from '@repo/database';
import {
  addGmailLabels,
  createDriveFolder,
  createGmailDraft,
  createSheetFromCsv,
  deleteCalendarEvent,
  driveFileExists,
  driveFolderUrl,
  ensureGmailLabels,
  listGmailInbox,
  replaceSheetCsv,
  sendGmailToSelf,
  upsertCalendarEvent,
} from './api';
import { type InboxLabel, classifySender, senderAddress } from './classify';
import { deleteLink, getGoogleSession, getLink, setLink } from './connection';
import { buildPartnerSheetCsv } from './partner-sheet-rows';
import { addDays, londonDate, offerDueDate } from './working-days';

/**
 * Every function here returns `{ skipped: true }` when Google is not
 * connected. Callers attach these to flows that must keep working without
 * Google (approving a hold, booking a viewing), so they also wrap the call
 * and treat a thrown error as "log and carry on".
 */
export type Skipped = { skipped: true };
const SKIPPED: Skipped = { skipped: true };

// ── 1. Gmail drafts ─────────────────────────────────────────────────────

/**
 * Put an email in the Kept mailbox's Drafts. It is NOT sent: the founder
 * opens Gmail, reads it and presses send. This is the "vendor emails are
 * never auto-sent" rule with the last step moved into Gmail.
 */
export const draftInGmail = async (input: {
  to: string;
  subject: string;
  text: string;
}): Promise<Skipped | { skipped: false; draftId: string; mailbox: string }> => {
  const session = await getGoogleSession();
  if (!session) {
    return SKIPPED;
  }
  const { draftId } = await createGmailDraft(session, input);
  return { skipped: false, draftId, mailbox: session.email };
};

// ── 2. Calendar: viewings + the offer deadline ──────────────────────────

type ViewingLink = { eventId?: string; deadlineEventId?: string };
const VIEWING_MINUTES = 45;

/**
 * Mirror one viewing into the Kept calendar: the viewing itself, plus an
 * all-day "offer due" marker two working days later (the public promise).
 * Safe to call any number of times; a cancelled or unscheduled viewing
 * has its events removed.
 */
export const syncViewingToCalendar = async (
  viewingId: string,
  appUrl: string
): Promise<
  Skipped | { skipped: false; action: 'synced' | 'removed' | 'none' }
> => {
  const session = await getGoogleSession();
  if (!session) {
    return SKIPPED;
  }
  const viewing = await database.viewing.findUnique({
    where: { id: viewingId },
    include: {
      partner: { select: { name: true } },
      deal: {
        select: { id: true, address: true, postcode: true, sellerName: true },
      },
    },
  });
  const linkKey = `viewing:${viewingId}`;
  const link = (await getLink<ViewingLink>(linkKey)) ?? {};

  if (!viewing || viewing.status === 'cancelled' || !viewing.scheduledAt) {
    if (!(link.eventId || link.deadlineEventId)) {
      return { skipped: false, action: 'none' };
    }
    if (link.eventId) {
      await deleteCalendarEvent(session, link.eventId);
    }
    if (link.deadlineEventId) {
      await deleteCalendarEvent(session, link.deadlineEventId);
    }
    await deleteLink(linkKey);
    return { skipped: false, action: 'removed' };
  }

  const { deal } = viewing;
  const place = `${deal.address}, ${deal.postcode}`;
  const dealUrl = `${appUrl.replace(/\/+$/, '')}/deals/${deal.id}`;
  const end = new Date(
    viewing.scheduledAt.getTime() + VIEWING_MINUTES * 60_000
  );
  const due = offerDueDate(viewing.scheduledAt);

  const eventId = await upsertCalendarEvent(
    session,
    {
      summary: `Viewing: ${place}`,
      location: place,
      description: [
        deal.sellerName ? `Seller: ${deal.sellerName}` : null,
        viewing.partner ? `Viewed by: ${viewing.partner.name}` : null,
        viewing.accessNotes ? `Access: ${viewing.accessNotes}` : null,
        `Written offer due: ${due}`,
        `Deal: ${dealUrl}`,
      ]
        .filter(Boolean)
        .join('\n'),
      start: {
        dateTime: viewing.scheduledAt.toISOString(),
        timeZone: 'Europe/London',
      },
      end: { dateTime: end.toISOString(), timeZone: 'Europe/London' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    },
    link.eventId
  );

  const deadlineEventId = await upsertCalendarEvent(
    session,
    {
      summary: `Offer due: ${place}`,
      description: [
        'Confirmed written offer is due today.',
        'We promise it within two working days of viewing.',
        `Deal: ${dealUrl}`,
      ].join('\n'),
      start: { date: due },
      end: { date: addDays(due, 1) },
    },
    link.deadlineEventId
  );

  await setLink(linkKey, { eventId, deadlineEventId });
  return { skipped: false, action: 'synced' };
};

// ── 3. Drive: one folder per deal ───────────────────────────────────────

type FolderLink = { folderId: string };
const DEAL_SUBFOLDERS = ['Photos', 'Legal', 'Offer', 'Comps'];

const ensureRootFolder = async (
  session: NonNullable<Awaited<ReturnType<typeof getGoogleSession>>>
): Promise<string> => {
  const existing = await getLink<FolderLink>('deals-root');
  if (existing && (await driveFileExists(session, existing.folderId))) {
    return existing.folderId;
  }
  const folderId = await createDriveFolder(session, 'Kept deals');
  await setLink('deals-root', { folderId });
  return folderId;
};

/** The saved Drive folder for a deal, without calling Google. */
export const getDealFolderUrl = async (
  dealId: string
): Promise<string | null> => {
  const link = await getLink<FolderLink>(`deal:${dealId}`);
  return link ? driveFolderUrl(link.folderId) : null;
};

/**
 * Make the deal's Drive folder (Photos, Legal, Offer, Comps) if it does not
 * exist yet. Never shares it: who sees a deal folder is the founder's call.
 */
export const ensureDealFolder = async (
  dealId: string
): Promise<Skipped | { skipped: false; url: string; created: boolean }> => {
  const session = await getGoogleSession();
  if (!session) {
    return SKIPPED;
  }
  const linkKey = `deal:${dealId}`;
  const existing = await getLink<FolderLink>(linkKey);
  if (existing && (await driveFileExists(session, existing.folderId))) {
    return {
      skipped: false,
      url: driveFolderUrl(existing.folderId),
      created: false,
    };
  }
  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { address: true, postcode: true },
  });
  if (!deal) {
    throw new Error('Deal not found');
  }
  const root = await ensureRootFolder(session);
  const folderId = await createDriveFolder(
    session,
    `${deal.address}, ${deal.postcode}`,
    root
  );
  for (const name of DEAL_SUBFOLDERS) {
    await createDriveFolder(session, name, folderId);
  }
  await setLink(linkKey, { folderId });
  return { skipped: false, url: driveFolderUrl(folderId), created: true };
};

// ── 4. Gmail labels ─────────────────────────────────────────────────────

const LABEL_NAME: Record<InboxLabel, string> = {
  Seller: 'Kept/Seller',
  Solicitor: 'Kept/Solicitor',
  Agent: 'Kept/Agent',
};
const INBOX_SCAN_MAX = 40;

/**
 * Label recent inbox mail from people on our deals. Only labels (and stars
 * solicitor mail); it never archives, replies, or marks anything read.
 */
export const labelInbox = async (): Promise<
  Skipped | { skipped: false; scanned: number; labelled: number }
> => {
  const session = await getGoogleSession();
  if (!session) {
    return SKIPPED;
  }
  const labelIds = await ensureGmailLabels(session, Object.values(LABEL_NAME));
  const ours = new Set(Object.values(labelIds));
  const messages = (
    await listGmailInbox(session, 'in:inbox newer_than:2d', INBOX_SCAN_MAX)
  ).filter((m) => !m.labelIds.some((id) => ours.has(id)));

  const addresses = [
    ...new Set(
      messages.map((m) => senderAddress(m.from)).filter((a) => a !== null)
    ),
  ];
  if (addresses.length === 0) {
    return { skipped: false, scanned: messages.length, labelled: 0 };
  }

  const insensitive = (field: 'sellerEmail' | 'solicitorEmail') => ({
    OR: addresses.map((a) => ({
      [field]: { equals: a, mode: 'insensitive' as const },
    })),
  });
  const [sellers, solicitors, agents] = await Promise.all([
    database.deal.findMany({
      where: insensitive('sellerEmail'),
      select: { sellerEmail: true },
    }),
    database.deal.findMany({
      where: insensitive('solicitorEmail'),
      select: { solicitorEmail: true },
    }),
    database.estateAgentContact.findMany({
      where: {
        OR: addresses.map((a) => ({
          email: { equals: a, mode: 'insensitive' as const },
        })),
      },
      select: { email: true },
    }),
  ]);
  const lower = (values: (string | null)[]) =>
    new Set(values.filter((v) => v !== null).map((v) => v.toLowerCase()));
  const known = {
    sellers: lower(sellers.map((d) => d.sellerEmail)),
    solicitors: lower(solicitors.map((d) => d.solicitorEmail)),
    agents: lower(agents.map((a) => a.email)),
  };

  let labelled = 0;
  for (const message of messages) {
    const label = classifySender(message.from, known);
    if (!label) {
      continue;
    }
    await addGmailLabels(session, message.id, [
      labelIds[LABEL_NAME[label]],
      ...(label === 'Solicitor' ? ['STARRED'] : []),
    ]);
    labelled += 1;
  }
  return { skipped: false, scanned: messages.length, labelled };
};

// ── 5. Morning brief ────────────────────────────────────────────────────

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PRE_OFFER = ['new_lead', 'contacted', 'valuation'] as const;

/**
 * One short email from the Kept mailbox to itself: today's viewings,
 * offers due, emails waiting for review, SLA risks. Internal only.
 */
export const sendMorningBrief = async (
  appUrl: string,
  now: Date = new Date()
): Promise<
  Skipped | { skipped: false; viewings: number; offersDue: number }
> => {
  const session = await getGoogleSession();
  if (!session) {
    return SKIPPED;
  }
  const base = appUrl.replace(/\/+$/, '');
  const today = londonDate(now);

  const [viewings, heldEmails, slaBreaches, pendingActions] = await Promise.all(
    [
      database.viewing.findMany({
        where: {
          status: { not: 'cancelled' },
          // Wide window, narrowed to London dates below.
          scheduledAt: { gte: new Date(now.getTime() - 10 * 86_400_000) },
        },
        include: {
          deal: {
            select: { id: true, address: true, postcode: true, status: true },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      database.outreachHold.count({ where: { status: 'held' } }),
      database.founderAction.count({
        where: { type: 'sla_breach', status: 'pending' },
      }),
      database.founderAction.count({
        where: { status: { in: ['pending', 'in_progress'] } },
      }),
    ]
  );

  const todays = viewings.filter(
    (v) => v.scheduledAt && londonDate(v.scheduledAt) === today
  );
  // Viewed, no offer recorded yet, and the two-working-day date is today or past.
  const due = viewings.filter(
    (v) =>
      v.scheduledAt &&
      v.scheduledAt < now &&
      (PRE_OFFER as readonly string[]).includes(v.deal.status) &&
      offerDueDate(v.scheduledAt) <= today
  );

  const dealLine = (v: (typeof viewings)[number], extra: string) =>
    `<li><a href="${base}/deals/${v.deal.id}">${escapeHtml(
      `${v.deal.address}, ${v.deal.postcode}`
    )}</a> ${escapeHtml(extra)}</li>`;
  const time = (d: Date) =>
    d.toLocaleTimeString('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
    });
  const section = (title: string, items: string[], empty: string) =>
    `<h3 style="margin:20px 0 6px">${title}</h3>${
      items.length > 0
        ? `<ul style="margin:0;padding-left:20px">${items.join('')}</ul>`
        : `<p style="margin:0;color:#666">${empty}</p>`
    }`;

  const html = [
    '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;max-width:560px">',
    section(
      `Viewings today (${todays.length})`,
      todays.map((v) => dealLine(v, `at ${time(v.scheduledAt as Date)}`)),
      'None today.'
    ),
    section(
      `Offers due (${due.length})`,
      due.map((v) =>
        dealLine(
          v,
          `was due ${offerDueDate(v.scheduledAt as Date)}`.replace(
            `was due ${today}`,
            'due today'
          )
        )
      ),
      'Nothing due.'
    ),
    section(
      'Waiting for you',
      [
        `<li><a href="${base}/outreach/holds">${heldEmails} email${heldEmails === 1 ? '' : 's'} to review</a></li>`,
        `<li><a href="${base}/actions">${pendingActions} open action${pendingActions === 1 ? '' : 's'}</a>${
          slaBreaches > 0 ? `, <b>${slaBreaches} past SLA</b>` : ''
        }</li>`,
      ],
      ''
    ),
    '</div>',
  ].join('');

  await sendGmailToSelf(session, {
    subject: `Kept today: ${todays.length} viewing${todays.length === 1 ? '' : 's'}, ${due.length} offer${due.length === 1 ? '' : 's'} due`,
    html,
  });
  return { skipped: false, viewings: todays.length, offersDue: due.length };
};

// ── 6. Partner sheet ────────────────────────────────────────────────────

type SheetLink = { fileId: string };

export const partnerSheetUrl = (fileId: string): string =>
  `https://docs.google.com/spreadsheets/d/${fileId}`;

export const getPartnerSheetUrl = async (): Promise<string | null> => {
  const link = await getLink<SheetLink>('partner-sheet');
  return link ? partnerSheetUrl(link.fileId) : null;
};

/**
 * Refresh the anonymised pipeline Sheet. Created private; it reaches a
 * partner only when the founder shares it from Drive. The select below is
 * the whole privacy story: no address, seller, or price is ever read.
 */
export const refreshPartnerSheet = async (
  now: Date = new Date()
): Promise<Skipped | { skipped: false; url: string; rows: number }> => {
  const session = await getGoogleSession();
  if (!session) {
    return SKIPPED;
  }
  const deals = await database.deal.findMany({
    where: { status: { notIn: ['rejected', 'withdrawn'] } },
    select: {
      postcode: true,
      propertyType: true,
      bedrooms: true,
      status: true,
      stageEnteredAt: true,
    },
    orderBy: { stageEnteredAt: 'desc' },
  });
  const csv = buildPartnerSheetCsv(deals, now);

  const existing = await getLink<SheetLink>('partner-sheet');
  let fileId = existing?.fileId;
  if (fileId && (await driveFileExists(session, fileId))) {
    await replaceSheetCsv(session, fileId, csv);
  } else {
    fileId = await createSheetFromCsv(
      session,
      'Kept pipeline (partner view)',
      csv
    );
    await setLink('partner-sheet', { fileId });
  }
  return { skipped: false, url: partnerSheetUrl(fileId), rows: deals.length };
};
