export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="tnum font-display text-4xl font-bold tracking-tight text-court-800">
        {value}
      </span>
      <span className="text-sm text-ink-500">{label}</span>
    </div>
  );
}
