'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type TabId = 'queue' | 'calendar' | 'performance';

const TABS: Array<{ id: TabId; label: string; href: string }> = [
  { id: 'queue', label: 'Queue', href: '/marketing/queue' },
  { id: 'calendar', label: 'Calendar', href: '/marketing/calendar' },
  { id: 'performance', label: 'Performance', href: '/marketing/performance' },
];

export function MarketingTabs({
  queueCount,
  publishedCount,
}: {
  queueCount: number;
  publishedCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b">
      {TABS.map((t) => {
        const isActive = pathname.startsWith(t.href);
        const count =
          t.id === 'queue'
            ? queueCount
            : t.id === 'calendar'
              ? publishedCount
              : null;
        return (
          <Link
            key={t.id}
            href={t.href}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm transition ${
              isActive
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {count !== null && (
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                  isActive
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-foreground" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
