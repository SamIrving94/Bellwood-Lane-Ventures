import { Skeleton } from '@repo/design-system/components/ui/skeleton';

const EntriesLoading = () => (
  <div className="flex flex-1 flex-col gap-4 p-6">
    {/* Search bar */}
    <Skeleton className="h-10 w-full rounded-md" />
    {/* Count */}
    <Skeleton className="h-4 w-20" />
    {/* Entry cards */}
    {[1, 2, 3, 4, 5].map((i) => (
      <Skeleton key={i} className="h-24 w-full rounded-xl" />
    ))}
  </div>
);

export default EntriesLoading;
