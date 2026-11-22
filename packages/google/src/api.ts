import 'server-only';

import type { GoogleSession } from './connection';
import { type RawMessageInput, buildRawMessage } from './mime';

export class GoogleApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(`Google API ${status}: ${detail.slice(0, 300)}`);
    this.status = status;
  }
}

const call = async <T>(
  session: GoogleSession,
  url: string,
  init: {
    method?: string;
    json?: unknown;
    body?: BodyInit;
    contentType?: string;
  } = {}
): Promise<T> => {
  const response = await fetch(url, {
    method: init.method ?? (init.json || init.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(init.json ? { 'Content-Type': 'application/json' } : {}),
      ...(init.contentType ? { 'Content-Type': init.contentType } : {}),
    },
    body: init.json ? JSON.stringify(init.json) : init.body,
  });
  if (!response.ok) {
    throw new GoogleApiError(response.status, await response.text());
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
};

// ── Gmail ───────────────────────────────────────────────────────────────
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Create a draft in the Kept mailbox. Nothing is sent. */
export const createGmailDraft = async (
  session: GoogleSession,
  message: RawMessageInput
): Promise<{ draftId: string }> => {
  const draft = await call<{ id: string }>(session, `${GMAIL}/drafts`, {
    json: { message: { raw: buildRawMessage(message) } },
  });
  return { draftId: draft.id };
};

/** Send mail from the Kept mailbox to itself. Used for the morning brief only. */
export const sendGmailToSelf = async (
  session: GoogleSession,
  message: Omit<RawMessageInput, 'to'>
): Promise<void> => {
  await call(session, `${GMAIL}/messages/send`, {
    json: { raw: buildRawMessage({ ...message, to: session.email }) },
  });
};

/** Find-or-create labels by name; returns name → label id. */
export const ensureGmailLabels = async (
  session: GoogleSession,
  names: string[]
): Promise<Record<string, string>> => {
  const { labels = [] } = await call<{
    labels?: { id: string; name: string }[];
  }>(session, `${GMAIL}/labels`);
  const ids: Record<string, string> = {};
  for (const name of names) {
    const existing = labels.find((label) => label.name === name);
    ids[name] =
      existing?.id ??
      (
        await call<{ id: string }>(session, `${GMAIL}/labels`, {
          json: { name },
        })
      ).id;
  }
  return ids;
};

export type GmailMessageMeta = { id: string; labelIds: string[]; from: string };

export const listGmailInbox = async (
  session: GoogleSession,
  query: string,
  max: number
): Promise<GmailMessageMeta[]> => {
  const { messages = [] } = await call<{ messages?: { id: string }[] }>(
    session,
    `${GMAIL}/messages?${new URLSearchParams({ q: query, maxResults: String(max) })}`
  );
  const out: GmailMessageMeta[] = [];
  for (const { id } of messages) {
    const meta = await call<{
      labelIds?: string[];
      payload?: { headers?: { name: string; value: string }[] };
    }>(session, `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From`);
    out.push({
      id,
      labelIds: meta.labelIds ?? [],
      from:
        meta.payload?.headers?.find((h) => h.name.toLowerCase() === 'from')
          ?.value ?? '',
    });
  }
  return out;
};

export const addGmailLabels = async (
  session: GoogleSession,
  messageId: string,
  labelIds: string[]
): Promise<void> => {
  await call(session, `${GMAIL}/messages/${messageId}/modify`, {
    json: { addLabelIds: labelIds },
  });
};

// ── Calendar ────────────────────────────────────────────────────────────
const CALENDAR =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export type CalendarEventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  reminders?: {
    useDefault: false;
    overrides: { method: 'popup'; minutes: number }[];
  };
};

/**
 * Create the event, or update it when `eventId` is given. An event the
 * founder deleted by hand comes back as 404/410; it is recreated, since a
 * live viewing with no calendar entry is the worse outcome.
 */
export const upsertCalendarEvent = async (
  session: GoogleSession,
  event: CalendarEventInput,
  eventId?: string
): Promise<string> => {
  if (eventId) {
    try {
      await call(session, `${CALENDAR}/${eventId}`, {
        method: 'PATCH',
        json: event,
      });
      return eventId;
    } catch (err) {
      if (!(err instanceof GoogleApiError && [404, 410].includes(err.status))) {
        throw err;
      }
    }
  }
  return (await call<{ id: string }>(session, CALENDAR, { json: event })).id;
};

export const deleteCalendarEvent = async (
  session: GoogleSession,
  eventId: string
): Promise<void> => {
  try {
    await call(session, `${CALENDAR}/${eventId}`, { method: 'DELETE' });
  } catch (err) {
    // Already gone is the outcome we wanted.
    if (!(err instanceof GoogleApiError && [404, 410].includes(err.status))) {
      throw err;
    }
  }
};

// ── Drive ───────────────────────────────────────────────────────────────
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export const driveFolderUrl = (id: string): string =>
  `https://drive.google.com/drive/folders/${id}`;

export const createDriveFolder = async (
  session: GoogleSession,
  name: string,
  parentId?: string
): Promise<string> =>
  (
    await call<{ id: string }>(session, DRIVE, {
      json: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      },
    })
  ).id;

/** True when the file still exists and is not in the bin. */
export const driveFileExists = async (
  session: GoogleSession,
  id: string
): Promise<boolean> => {
  try {
    const file = await call<{ trashed?: boolean }>(
      session,
      `${DRIVE}/${id}?fields=trashed`
    );
    return !file.trashed;
  } catch (err) {
    if (err instanceof GoogleApiError && err.status === 404) {
      return false;
    }
    throw err;
  }
};

/** Upload CSV and have Drive convert it into a Google Sheet. */
export const createSheetFromCsv = async (
  session: GoogleSession,
  name: string,
  csv: string
): Promise<string> => {
  const boundary = `kept-${Date.now()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    }),
    `--${boundary}`,
    'Content-Type: text/csv',
    '',
    csv,
    `--${boundary}--`,
  ].join('\r\n');
  return (
    await call<{ id: string }>(
      session,
      `${DRIVE_UPLOAD}?uploadType=multipart`,
      {
        body,
        contentType: `multipart/related; boundary=${boundary}`,
      }
    )
  ).id;
};

/** Replace a Sheet's contents in place, so its link and sharing survive. */
export const replaceSheetCsv = async (
  session: GoogleSession,
  fileId: string,
  csv: string
): Promise<void> => {
  await call(session, `${DRIVE_UPLOAD}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    body: csv,
    contentType: 'text/csv',
  });
};
