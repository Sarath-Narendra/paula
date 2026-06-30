import { cn } from "@/lib/utils";

/** Paula wordmark + mark. The mark is a stylized "living schedule" orbit. */
export function PaulaLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PaulaMark className="h-7 w-7" />
      {showWordmark && (
        <span className="text-xl font-semibold tracking-tight">Paula</span>
      )}
    </span>
  );
}

export function PaulaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="paula-grad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="oklch(0.65 0.2 285)" />
          <stop offset="100%" stopColor="oklch(0.55 0.22 320)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#paula-grad)" />
      {/* orbiting dot — the schedule that keeps moving */}
      <circle cx="16" cy="4.5" r="2.5" fill="white" />
      {/* check / path inside */}
      <path
        d="M10 16.5l4 4 8-9"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
