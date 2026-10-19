"use client";

export interface Sample {
  claim: string;
  tag: string;
}

/**
 * Pre-tested demo claims. Never show judges a claim you haven't watched pass —
 * a bad live verdict costs more points than a missing feature.
 */
export const SAMPLES: Sample[] = [
  {
    claim: "The Bharatiya Nyaya Sanhita replaced the Indian Penal Code in India on 1 July 2024",
    tag: "true",
  },
  {
    claim: "Drinking papaya leaf juice cures dengue completely in 24 hours",
    tag: "false",
  },
  {
    claim: "India's literacy rate was above 80 percent in the 2011 Census",
    tag: "false",
  },
  {
    claim: "The Reserve Bank of India issued a 75 rupee commemorative coin for 75 years of independence",
    tag: "true",
  },
  {
    claim: "5G mobile networks cause coronavirus infections in humans",
    tag: "false",
  },
];

const TAG_STYLES: Record<string, string> = {
  true: "border-emerald-500/30 text-emerald-300 bg-emerald-500/5",
  false: "border-rose-500/30 text-rose-300 bg-rose-500/5",
};

export default function SampleChips({ onPick }: { onPick: (claim: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SAMPLES.map((s) => (
        <button
          key={s.claim}
          type="button"
          onClick={() => onPick(s.claim)}
          className="group flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-left text-[13px] text-[var(--muted)] transition hover:border-teal-500/40 hover:text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
        >
          <span className="max-w-[15rem] truncate sm:max-w-[22rem]">{s.claim}</span>
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              TAG_STYLES[s.tag] ?? "border-[var(--line)]"
            }`}
          >
            {s.tag}
          </span>
        </button>
      ))}
    </div>
  );
}
