import { Skeleton } from "@/components/ui/skeleton";

export function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-16 rounded-lg" />
      <div className="panel grid overflow-hidden lg:grid-cols-[0.3fr_1fr]">
        <div className="space-y-3 p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="mt-8 h-12 w-full" />
        </div>
        <Skeleton className="m-2 min-h-48 rounded-xl lg:min-h-72" />
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
