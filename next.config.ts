import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep API routes fully dynamic — the whole point is live web data.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
