import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimCheck — verify any claim against the live web",
  description:
    "Paste a claim, get a verdict in ~15 seconds — with the exact sentences that prove it, quoted word-for-word from live web pages. Evidence is extracted, never generated.",
  openGraph: {
    title: "ClaimCheck",
    description:
      "Verify any claim against the live web, with verbatim proof. Powered by TinyFish Search, Fetch and Research APIs.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-grid antialiased">{children}</body>
    </html>
  );
}
