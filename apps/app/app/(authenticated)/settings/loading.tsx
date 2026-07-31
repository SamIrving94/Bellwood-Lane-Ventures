import { Skeleton } from '@repo/design-system/components/ui/skeleton';

const SettingsLoading = () => (
  <div className="flex flex-1 flex-col gap-8 p-6">
    {/* Account section */}
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="rounded-xl border p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>
    </section>

    {/* API Keys section */}
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="rounded-xl border p-5">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </section>

    {/* Notifications section */}
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="rounded-xl border p-5">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </section>
  </div>
);

export default SettingsLoading;
