/**
 * ZeroDay-Guard AI — design tokens.
 *
 * The palette is deliberately restrained: warm neutral canvas, crisp 1px
 * hairlines, and exactly ONE saturated accent (accent) reserved for primary
 * actions and active state. Severity colours are a separate, muted ramp so a
 * CRITICAL finding never competes with the accent.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F5F3",
        surface: "#FFFFFF",
        "surface-2": "#FAFAF9",
        "surface-3": "#F1F1EF",
        ink: "#17171A",
        "ink-2": "#43434A",
        muted: "#6E6E78",
        faint: "#9A9AA3",
        line: "#E4E4E1",
        "line-strong": "#D3D3CE",
        accent: {
          DEFAULT: "#1D4ED8",
          hover: "#1A43B4",
          active: "#163AA0",
          soft: "#EFF3FF",
          line: "#C3D2FB",
        },
        critical: { fg: "#B42318", bg: "#FEF3F2", line: "#FBCDC9" },
        high: { fg: "#B54708", bg: "#FFF6ED", line: "#F8D3AE" },
        medium: { fg: "#96660A", bg: "#FBF7E6", line: "#EBD79A" },
        low: { fg: "#0369A1", bg: "#F0F8FC", line: "#BBDCEE" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(16,16,20,0.04)",
        sm: "0 1px 2px rgba(16,16,20,0.04), 0 1px 3px rgba(16,16,20,0.06)",
        md: "0 1px 2px rgba(16,16,20,0.04), 0 4px 10px rgba(16,16,20,0.06)",
        pop: "0 2px 6px rgba(16,16,20,0.06), 0 12px 32px rgba(16,16,20,0.12)",
        ring: "0 0 0 1px rgba(16,16,20,0.05), 0 1px 2px rgba(16,16,20,0.04)",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.985)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out both",
        "slide-up": "slide-up 180ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 140ms cubic-bezier(0.16, 1, 0.3, 1) both",
        spin: "spin 900ms linear infinite",
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
