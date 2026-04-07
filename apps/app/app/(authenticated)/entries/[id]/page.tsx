import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { format } from 'date-fns';
import { MessageSquareIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';

type EntryPageProps = {
  params: Promise<{ id: string }>;
};

export const generateMetadata = async ({
  params,
}: EntryPageProps): Promise<Metadata> => {
  const { userId } = await auth();
  if (!userId) return { title: 'Microjournal' };

  const { id } = await params;
  const entry = await database.journalEntry.findFirst({
    where: { id, userId },
  });
  if (!entry) return { title: 'Entry not found · Microjournal' };
  return {
    title: `${format(new Date(entry.createdAt), 'MMM d, yyyy')} · Microjournal`,
  };
};

const EntryPage = async ({ params }: EntryPageProps) => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;

  const entry = await database.journalEntry.findFirst({
    where: { id, userId },
  });

  if (!entry) {
    notFound();
  }

  return (
    <>
      <Header pages={['History']} page={format(new Date(entry.createdAt), 'MMMM d, yyyy')} />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <time className="text-sm text-muted-foreground">
            {format(new Date(entry.createdAt), 'EEEE, MMMM d, yyyy · h:mm a')}
          </time>
          {entry.source === 'whatsapp' && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <MessageSquareIcon className="h-3 w-3" />
              WhatsApp
            </span>
          )}
        </div>
        <p className="max-w-prose whitespace-pre-wrap leading-relaxed">
          {entry.content}
        </p>
      </div>
    </>
  );
};

export default EntryPage;
