"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white border border-accent shadow-xs hover:bg-accent-hover hover:border-accent-hover active:bg-accent-active",
  secondary:
    "bg-surface text-ink border border-line-strong shadow-xs hover:bg-surface-2 hover:border-[#B9B9B2] active:bg-surface-3",
  ghost:
    "bg-transparent text-ink-2 border border-transparent hover:bg-surface-3 hover:text-ink active:bg-line",
  quiet:
    "bg-surface-3 text-ink-2 border border-transparent hover:bg-line hover:text-ink",
  danger:
    "bg-red-600 text-white border border-red-600 shadow-xs hover:bg-red-700 hover:border-red-700 active:bg-red-800",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5",
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-[6px] font-medium",
        "transition-[background-color,border-color,color,box-shadow] duration-150 ease-swift",
        "disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(" ")}
      {...props}
    />
  );
});

export default Button;
