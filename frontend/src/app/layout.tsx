import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroDay-Guard AI — Autonomous Threat Assessment",
  description:
    "Autonomous cybersecurity threat assessor. Crawls a target with the TinyFish web agent, extracts exploit intelligence, scores it with CodeBERT + AST analysis, and generates a remediation patch.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-grid font-sans">{children}</body>
    </html>
  );
}
