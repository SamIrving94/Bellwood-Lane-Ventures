import { env } from '@/env';
import { auth, currentUser } from '@repo/auth/server';
import { database } from '@repo/database';
import { SidebarProvider } from '@repo/design-system/components/ui/sidebar';
import { secure } from '@repo/security';
import type { ReactNode } from 'react';
import { GlobalSidebar } from './components/sidebar';
import { ConciergeOverlay } from './components/concierge-overlay';
import { WhatsNewPopup } from './components/whats-new-popup';

type AppLayoutProperties = {
  readonly children: ReactNode;
};

const AppLayout = async ({ children }: AppLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await secure(['CATEGORY:PREVIEW']);
  }

  const user = await currentUser();
  const { redirectToSignIn } = await auth();

  if (!user) {
    return redirectToSignIn();
  }

  const pendingActionCount = await database.founderAction.count({
    where: { status: { in: ['pending', 'in_progress'] } },
  });

  return (
    <SidebarProvider>
      <GlobalSidebar pendingActionCount={pendingActionCount}>
        {children}
      </GlobalSidebar>
      <ConciergeOverlay />
      <WhatsNewPopup />
    </SidebarProvider>
  );
};

export default AppLayout;
