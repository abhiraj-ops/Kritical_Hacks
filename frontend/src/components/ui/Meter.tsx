"use client";

/**
 * A labelled horizontal meter.
 *
 * A radar polygon was the previous visualisation: it looked impressive and
 * read terribly. Six labelled bars with printed values let an analyst compare
 * two dimensions at a glance, which is the only job this widget has.
 */
export default function Meter({
  label,
  value,
  max = 100,
  color = "#1D4ED8",
  suffix = "",
  hint,
  neutral = false,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
  suffix?: string;
  hint?: string;
  /** Draw the fill in graphite instead of a severity colour. */
  neutral?: boolean;
}) {
  const clamped = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
  const pct = max === 0 ? 0 : (clamped / max) * 100;
  const fill = neutral ? "#8E8E97" : color;

  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[12.5px] text-ink-2" title={hint ?? label}>
          {label}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-ink">
          {Number.isFinite(value) ? Math.round(clamped) : "—"}
          {suffix}
        </span>
      </div>
      <div
        className="mt-1.5 h-[6px] w-full overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-swift"
          style={{ width: `${pct}%`, backgroundColor: fill }}
        />
      </div>
    </div>
  );
}
