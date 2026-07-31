import { Skeleton } from '@repo/design-system/components/ui/skeleton';

const DashboardLoading = () => (
  <div className="flex flex-1 flex-col gap-6 p-6">
    {/* Stats row */}
    <div className="flex gap-3">
      <Skeleton className="h-10 w-32 rounded-lg" />
      <Skeleton className="h-10 w-48 rounded-lg" />
    </div>

    {/* Composer */}
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="flex justify-end">
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>

    {/* Entry cards */}
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

export default DashboardLoading;
