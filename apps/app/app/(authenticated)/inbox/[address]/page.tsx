import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { bareAddress } from '@repo/email/addresses';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { ReplyForm } from './reply-form';

export const metadata: Metadata = {
  title: 'Conversation — Kept',
};

const when = (d: Date) =>
  d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const ThreadPage = async ({
  params,
}: {
  params: Promise<{ address: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const { address: raw } = await params;
  const address = bareAddress(decodeURIComponent(raw));
  if (!address) {
    notFound();
  }

  const messages = await database.emailMessage.findMany({
    where: { counterparty: address },
    orderBy: { createdAt: 'asc' },
  });
  if (messages.length === 0) {
    notFound();
  }

  // Opening the conversation is reading it.
  await database.emailMessage.updateMany({
    where: { counterparty: address, direction: 'inbound', readAt: null },
    data: { readAt: new Date() },
  });

  const newestFirst = [...messages].reverse();
  const dealId = newestFirst.find((m) => m.dealId)?.dealId ?? null;
  const quoteRequestId =
    newestFirst.find((m) => m.quoteRequestId)?.quoteRequestId ?? null;

  return (
    <>
      <Header page={address} pages={[{ title: 'Inbox', url: '/inbox' }]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="space-y-1">
          <h1 className="font-bold text-xl">{address}</h1>
          <p className="text-muted-foreground text-sm">
            {messages.length} email{messages.length === 1 ? '' : 's'}.
            {dealId && (
              <>
                {' '}
                <Link className="underline" href={`/deals/${dealId}`}>
                  Open the deal
                </Link>
                .
              </>
            )}
            {quoteRequestId && (
              <>
                {' '}
                <Link className="underline" href={`/quotes/${quoteRequestId}`}>
                  Open the quote
                </Link>
                .
              </>
            )}
          </p>
        </div>

        <div className="space-y-4">
          {messages.map((m) => {
            const inbound = m.direction === 'inbound';
            return (
              <div
                className={
                  inbound
                    ? 'mr-8 rounded-lg border border-primary/40 bg-card p-4'
                    : 'ml-8 rounded-lg border bg-muted/40 p-4'
                }
                key={m.id}
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-sm">
                    {inbound ? 'They wrote' : 'We sent'}: {m.subject}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {when(m.createdAt)}
                  </p>
                </div>
                {/* Text only. Inbound HTML is untrusted and is never rendered. */}
                <p className="whitespace-pre-wrap break-words text-sm">
                  {m.textBody ||
                    '(Sent as a designed template with no plain-text copy, so the wording is not shown here.)'}
                </p>
                {m.attachmentCount > 0 && (
                  <p className="mt-2 text-muted-foreground text-xs">
                    {m.attachmentCount} attachment
                    {m.attachmentCount === 1 ? '' : 's'}. Open the email in
                    Gmail to see {m.attachmentCount === 1 ? 'it' : 'them'}.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <ReplyForm address={address} />
      </div>
    </>
  );
};

export default ThreadPage;
