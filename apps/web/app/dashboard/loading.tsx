import { Skeleton } from "../../components/ui";

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-[1080px] px-[5vw] py-12" aria-busy="true">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-3 h-9 w-72" />
      <div className="mb-8 flex gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => `row-${i}`).map((key) => (
          <Skeleton className="h-20" key={key} />
        ))}
      </div>
    </main>
  );
}
