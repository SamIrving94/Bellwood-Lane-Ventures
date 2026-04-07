import { Skeleton } from '@repo/design-system/components/ui/skeleton';

const CalendarLoading = () => (
  <div className="flex flex-1 flex-col gap-6 p-6">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Calendar */}
      <Skeleton className="h-[300px] w-full rounded-xl lg:h-[320px] lg:w-[280px] lg:shrink-0" />

      {/* Entry list */}
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-4 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

export default CalendarLoading;
