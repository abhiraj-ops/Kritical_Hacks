"use client";

/**
 * A single keyboard key. Rendered small, monospaced and inset so a shortcut
 * reads as part of the chrome rather than as body copy.
 */
export default function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={[
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px]",
        "border border-line-strong bg-surface px-1 font-mono text-[10px] font-medium leading-none text-muted",
        "shadow-[0_1px_0_rgba(16,16,20,0.05)]",
        className,
      ].join(" ")}
    >
      {children}
    </kbd>
  );
}
