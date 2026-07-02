export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-10 items-center justify-center rounded-full bg-court-100 text-sm font-bold text-court-800 ${className}`.trim()}
    >
      {initials}
    </span>
  );
}
