import { Skeleton } from "../../components/ui";

export default function CoachesLoading() {
  return (
    <main className="mx-auto max-w-[1080px] px-[5vw] py-12" aria-busy="true">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-4 w-80 max-w-full" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {Array.from({ length: 6 }, (_, i) => `card-${i}`).map((key) => (
          <Skeleton className="h-40" key={key} />
        ))}
      </div>
    </main>
  );
}
