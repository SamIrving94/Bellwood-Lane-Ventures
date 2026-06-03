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
  InboxIcon,
  KanbanIcon,
  LineChartIcon,
  MailIcon,
  MegaphoneIcon,
  SearchIcon,
  Settings2Icon,
  TargetIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type GlobalSidebarProperties = {
  readonly children: ReactNode;
  readonly pendingActionCount?: number;
};

/**
 * Sidebar — three thematic groups, 10 visible items + 3 system.
 *
 * Surfacing previously-hidden routes that have real product value:
 *   - Quotes      → /quotes (agent SLA inbox — the 4hr promise)
 *   - Leads       → /leads (scouting output)
 *   - Research    → /research (George concierge)
 *   - Contacts    → /contacts (CRM)
 *   - Documents   → /documents (probate / lease / contract review)
 *   - Admin       → /admin/llm-usage (cost + reliability dashboard)
 *
 * Still off-nav by design (reachable via search / direct URL):
 *   - /actions (Today already shows actions)
 *   - /agents, /auctions, /campaigns, /deals, /intake, /partners, /valuations
 */
const data = {
  dealFlow: [
    { title: 'Today', url: '/', icon: InboxIcon, hasBadge: true },
    { title: 'Quotes', url: '/quotes', icon: FileTextIcon },
    { title: 'Leads', url: '/leads', icon: TargetIcon },
    { title: 'Appraisals', url: '/appraisals', icon: GavelIcon },
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
    { title: 'Contacts', url: '/contacts', icon: UsersIcon },
    { title: 'Documents', url: '/documents', icon: FileTextIcon },
  ],
  system: [
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
  '/pipeline': 'pipeline',
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
