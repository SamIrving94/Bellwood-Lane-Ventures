'use client';

import { UserButton } from '@repo/auth/client';
import { ModeToggle } from '@repo/design-system/components/mode-toggle';
import { Button } from '@repo/design-system/components/ui/button';
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
import { NotificationsTrigger } from '@repo/notifications/components/trigger';
import {
  BotIcon,
  BuildingIcon,
  ContactIcon,
  GaugeIcon,
  InboxIcon,
  KanbanIcon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  ScaleIcon,
  SearchIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type GlobalSidebarProperties = {
  readonly children: ReactNode;
  readonly pendingActionCount?: number;
};

const data = {
  navMain: [
    {
      title: 'Action Centre',
      url: '/actions',
      icon: InboxIcon,
      hasBadge: true,
    },
    {
      title: 'Dashboard',
      url: '/',
      icon: GaugeIcon,
    },
    {
      title: 'Pipeline',
      url: '/pipeline',
      icon: KanbanIcon,
    },
    {
      title: 'Leads',
      url: '/leads',
      icon: SearchIcon,
    },
    {
      title: 'Intake',
      url: '/intake',
      icon: MessageSquareIcon,
    },
    {
      title: 'Valuations',
      url: '/valuations',
      icon: ScaleIcon,
    },
    {
      title: 'Contacts',
      url: '/contacts',
      icon: UsersIcon,
    },
    {
      title: 'Outreach',
      url: '/outreach',
      icon: MailIcon,
    },
    {
      title: 'Campaigns',
      url: '/campaigns',
      icon: MegaphoneIcon,
    },
    {
      title: 'Agents',
      url: '/agents',
      icon: BotIcon,
    },
  ],
  navSecondary: [
    {
      title: 'Eval Models',
      url: '/settings/evals',
      icon: SlidersHorizontalIcon,
    },
    {
      title: 'Settings',
      url: '/settings',
      icon: Settings2Icon,
    },
  ],
};

export const GlobalSidebar = ({ children, pendingActionCount = 0 }: GlobalSidebarProperties) => {
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
                  <span className="font-semibold text-sm">Bellwood Ventures</span>
                )}
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Deal Management</SidebarGroupLabel>
            <SidebarMenu>
              {data.navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={
                      item.url === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.url)
                    }
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                      {'hasBadge' in item && item.hasBadge && pendingActionCount > 0 && (
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
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {data.navSecondary.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  asChild
                >
                  <div className="h-4 w-4">
                    <NotificationsTrigger />
                  </div>
                </Button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </>
  );
};
