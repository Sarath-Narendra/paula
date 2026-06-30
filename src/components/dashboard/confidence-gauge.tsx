import { cn } from "@/lib/utils";

function toneFor(value: number) {
  if (value >= 75) return { stroke: "var(--chart-4)", text: "text-emerald-600" };
  if (value >= 50) return { stroke: "var(--chart-3)", text: "text-amber-600" };
  return { stroke: "var(--chart-1)", text: "text-rose-600" };
}

/**
 * Semicircular confidence gauge (pure SVG, no client JS).
 * `value` is 0–100.
 */
export function ConfidenceGauge({
  value,
  size = 160,
  label = "confidence",
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Semicircle from 180° to 360° (top half), length = π·r.
  const arc = Math.PI * r;
  const filled = (v / 100) * arc;
  const tone = toneFor(v);

  const describeArc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div
      className="relative inline-flex flex-col items-center"
      style={{ width: size, height: size / 2 + 28 }}
    >
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        {/* track */}
        <path
          d={describeArc}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* value */}
        <path
          d={describeArc}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arc}`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className={cn("text-3xl font-bold tabular-nums", tone.text)}>
          {Math.round(v)}%
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
