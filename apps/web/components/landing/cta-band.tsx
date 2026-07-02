import { Button, CourtLines } from "../ui";

export function CtaBand() {
  return (
    <section
      aria-labelledby="cta"
      className="relative overflow-hidden bg-court-700 px-[5vw] py-20 dark:bg-[#14472f]"
    >
      <CourtLines
        className="pointer-events-none absolute -right-16 -top-10 w-96 rotate-6 text-white/10"
        variant="field"
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        <h2 className="m-0 font-display text-4xl font-bold tracking-tight text-white" id="cta">
          The court is waiting. <span className="text-lime-400">Get on it.</span>
        </h2>
        <p className="m-0 max-w-lg text-white/80">
          One account for playing, coaching, and running venues — free, open source, and built for
          Filipino pickleball.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            className="!bg-lime-400 !border-lime-400 !text-court-950 hover:!bg-lime-300"
            href="/register"
          >
            Join CourtLink
          </Button>
          <Button
            className="!border-white/40 !text-white hover:!bg-white/10"
            href="/courts"
            variant="secondary"
          >
            Find a court first
          </Button>
        </div>
      </div>
    </section>
  );
}
