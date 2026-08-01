import { env } from '@/env';
import { auth, currentUser, isFounder } from '@repo/auth/server';
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

  // Signed in is not the same as allowed in. Sign-up is open, so the dashboard
  // itself has to check authorisation — see packages/auth/require-founder.ts.
  // Rendered rather than thrown so an unauthorised account gets a dead end,
  // not a stack trace.
  if (!(await isFounder())) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-2 text-center">
          <h1 className="font-semibold text-lg">Not authorised</h1>
          <p className="text-muted-foreground text-sm">
            This account does not have access to this dashboard.
          </p>
          <p className="text-muted-foreground text-xs">
            If you are a founder seeing this, access is granted by the
            FOUNDER_USER_IDS environment variable. Check the deployment logs for
            the exact reason.
          </p>
        </div>
      </div>
    );
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
