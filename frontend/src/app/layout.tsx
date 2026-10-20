import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

/**
 * Two families, used with intent:
 *  - Inter carries every piece of UI text and all numeric readouts.
 *  - IBM Plex Mono is reserved for machine output: URLs, CVEs, diffs, logs.
 *
 * Nothing else gets a third face, and neither face is decorative.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ZeroDay-Guard AI — Threat Assessment Workspace",
  description:
    "Point ZeroDay-Guard at a URL and it crawls the live web with an AI browser agent, harvests exploit intelligence, scores the risk with static analysis, and returns a remediation patch.",
  applicationName: "ZeroDay-Guard AI",
  robots: { index: true, follow: true },
  openGraph: {
    title: "ZeroDay-Guard AI — Threat Assessment Workspace",
    description:
      "Autonomous threat assessment: live-web exploit intelligence, ML risk scoring and generated remediation patches.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F5F3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
