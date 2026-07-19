'use client';

import { UserButton } from '@repo/auth/client';
import { ModeToggle } from '@repo/design-system/components/mode-toggle';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@repo/design-system/components/ui/sidebar';
import {
  BuildingIcon,
  CompassIcon,
  FileTextIcon,
  GaugeIcon,
  GavelIcon,
  HammerIcon,
  InboxIcon,
  KanbanIcon,
  LineChartIcon,
  MailIcon,
  MapIcon,
  MegaphoneIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Settings2Icon,
  SheetIcon,
  TargetIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type GlobalSidebarProperties = {
  readonly children: ReactNode;
  readonly pendingActionCount?: number;
};

/**
 * Sidebar — the founder decision loop, not a page-per-system directory.
 * Triage (Leads) → Decide (Appraisals/Batch) → Progress (Pipeline) →
 * Close (Book).
 *
 * Off-nav by design (reachable via direct URL / in-page links):
 *   - /actions (Today already shows actions)
 *   - /contacts, /intake → merged into Outreach (People / Inbox tabs)
 *   - /partners (agent-referral channel — shelved, not an active bet)
 *   - /auctions stays: it feeds the buying pipeline
 * Deleted outright (were dead or Paperclip-era): /agents, /campaigns,
 * /valuations.
 */
const data = {
  dealFlow: [
    { title: 'Today', url: '/', icon: InboxIcon, hasBadge: true },
    { title: 'Quotes', url: '/quotes', icon: FileTextIcon },
    { title: 'Leads', url: '/leads', icon: TargetIcon },
    { title: 'Auctions', url: '/auctions', icon: HammerIcon },
    { title: 'Deep appraisals', url: '/appraisals', icon: GavelIcon },
    { title: 'Batch', url: '/batch', icon: SheetIcon },
    { title: 'Pipeline', url: '/pipeline', icon: KanbanIcon },
  ],
  money: [
    { title: 'Book', url: '/book', icon: LineChartIcon },
    { title: 'Investors', url: '/investors', icon: BuildingIcon },
  ],
  comms: [
    { title: 'Research', url: '/research', icon: SearchIcon },
    { title: 'Marketing', url: '/marketing', icon: MegaphoneIcon },
    { title: 'Outreach', url: '/outreach', icon: MailIcon },
    { title: 'Documents', url: '/documents', icon: FileTextIcon },
  ],
  system: [
    {
      title: 'Valuation method',
      url: '/settings/valuation',
      icon: SlidersHorizontalIcon,
    },
    { title: 'Strategy', url: '/strategy', icon: MapIcon },
    { title: 'Guide', url: '/guide', icon: CompassIcon },
    { title: 'Settings', url: '/settings', icon: Settings2Icon },
    { title: 'LLM usage', url: '/admin/llm-usage', icon: GaugeIcon },
  ],
};

type NavItem = {
  title: string;
  url: string;
  icon: typeof InboxIcon;
  hasBadge?: boolean;
};

// Stable slug per nav item for the in-app tour to anchor on. Selectors
// live in apps/app/app/(authenticated)/guide/tours.ts — keep these in sync.
const TOUR_SLUGS: Record<string, string> = {
  '/': 'today',
  '/quotes': 'quotes',
  '/leads': 'leads',
  '/appraisals': 'appraisals',
  '/batch': 'batch',
  '/pipeline': 'pipeline',
  '/strategy': 'strategy',
  '/book': 'book',
  '/investors': 'investors',
  '/research': 'research',
  '/marketing': 'marketing',
  '/outreach': 'outreach',
  '/contacts': 'contacts',
  '/documents': 'documents',
  '/guide': 'guide',
  '/settings': 'settings',
  '/admin/llm-usage': 'llm-usage',
};

function NavSection({
  label,
  items,
  pathname,
  pendingActionCount,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  pendingActionCount: number;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem
            key={item.title}
            data-tour={
              TOUR_SLUGS[item.url]
                ? `sidebar-${TOUR_SLUGS[item.url]}`
                : undefined
            }
          >
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              isActive={
                item.url === '/' ? pathname === '/' : pathname.startsWith(item.url)
              }
            >
              <Link href={item.url}>
                <item.icon />
                <span>{item.title}</span>
                {item.hasBadge && pendingActionCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                    {pendingActionCount > 99 ? '99+' : pendingActionCount}
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export const GlobalSidebar = ({
  children,
  pendingActionCount = 0,
}: GlobalSidebarProperties) => {
  const sidebar = useSidebar();
  const pathname = usePathname();

  return (
    <>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
                <BuildingIcon className="h-5 w-5 text-primary" />
                {sidebar.open && (
                  <span className="font-semibold text-sm">Bellwoods Lane</span>
                )}
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavSection
            label="Deal flow"
            items={data.dealFlow}
            pathname={pathname}
            pendingActionCount={pendingActionCount}
          />
          <NavSection
            label="Money"
            items={data.money}
            pathname={pathname}
            pendingActionCount={pendingActionCount}
          />
          <NavSection
            label="Comms"
            items={data.comms}
            pathname={pathname}
            pendingActionCount={pendingActionCount}
          />
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {data.system.map((item) => (
                  <SidebarMenuItem
                    key={item.title}
                    data-tour={
                      TOUR_SLUGS[item.url]
                        ? `sidebar-${TOUR_SLUGS[item.url]}`
                        : undefined
                    }
                  >
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.url)}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: 'flex overflow-hidden w-full',
                    userButtonBox: 'flex-row-reverse',
                    userButtonOuterIdentifier: 'truncate pl-0',
                  },
                }}
              />
              <div className="flex shrink-0 items-center gap-px">
                <ModeToggle />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </>
  );
};
