import {
  SUPPORTED_PLATFORMS,
  getConnectedAccounts,
} from '@/lib/social/ayrshare-accounts';
import { auth } from '@repo/auth/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { ConnectButton } from './connect-button';

export const metadata: Metadata = {
  title: 'Social accounts — Bellwood Lane',
  description: 'Connect the social accounts approved posts publish to.',
};

export const dynamic = 'force-dynamic';

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export default async function SocialAccountsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const status = await getConnectedAccounts();
  const connectedSet = new Set(status.connected);
  const anyConnected = status.connected.length > 0;

  return (
    <>
      <Header pages={[]} page="Social accounts" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="font-semibold text-2xl">Social accounts</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Connect Anthony's LinkedIn, Instagram &amp; Facebook so approved
            marketing posts publish to the real accounts. You authorise each
            network on Ayrshare's secure page — we never see your passwords.
          </p>
        </div>

        {!status.configured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
            <p className="font-medium">Not set up yet</p>
            <p className="mt-1">
              Add an <code>AYRSHARE_API_KEY</code> to the app (create a free
              account at ayrshare.com). Once it's set, this page lets you
              connect each social account. Instagram &amp; Facebook also need a
              Meta Business account + ~2–4 weeks Meta app review.
            </p>
          </div>
        )}

        {status.error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 text-sm">
            Couldn't reach Ayrshare ({status.error}). Check the API key.
          </div>
        )}

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Connected accounts</h2>
            <ConnectButton
              configured={status.configured}
              label={anyConnected ? 'Manage accounts' : 'Connect accounts'}
            />
          </div>

          <ul className="mt-4 divide-y">
            {SUPPORTED_PLATFORMS.map((platform) => {
              const isConnected = connectedSet.has(platform);
              const name = status.displayNames.find(
                (d) => d.platform === platform
              )?.displayName;
              return (
                <li
                  key={platform}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium">{PLATFORM_LABELS[platform]}</p>
                    {isConnected && name ? (
                      <p className="text-muted-foreground text-xs">{name}</p>
                    ) : null}
                  </div>
                  {isConnected ? (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800 text-xs">
                      ✓ Connected
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-medium text-slate-500 text-xs">
                      Not connected
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-muted-foreground text-xs">
          Once connected, the <strong>Approve &amp; publish</strong> button on a
          marketing draft posts straight to that account. Nothing publishes
          automatically — you always approve first.
        </p>
      </div>
    </>
  );
}
