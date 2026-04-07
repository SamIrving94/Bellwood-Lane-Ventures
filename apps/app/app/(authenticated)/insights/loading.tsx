import { Skeleton } from '@repo/design-system/components/ui/skeleton';

const InsightsLoading = () => (
  <div className="flex flex-1 flex-col gap-8 p-6">
    {/* Stats row */}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
    {/* Chart */}
    <Skeleton className="h-64 w-full rounded-xl" />
    {/* Chart */}
    <Skeleton className="h-64 w-full rounded-xl" />
  </div>
);

export default InsightsLoading;
