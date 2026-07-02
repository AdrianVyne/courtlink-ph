import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { Button, CourtLines } from "../components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader session={null} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-[5vw] py-24 text-center">
        <CourtLines className="w-64 text-court-200" variant="field" />
        <h1 className="m-0 font-display text-5xl font-bold tracking-tight text-ink-900">
          Out of bounds
        </h1>
        <p className="m-0 max-w-md text-ink-500">
          This page does not exist. The court you are looking for may have moved or was never
          listed.
        </p>
        <Button href="/">Back to the court</Button>
      </main>
      <SiteFooter />
    </div>
  );
}
