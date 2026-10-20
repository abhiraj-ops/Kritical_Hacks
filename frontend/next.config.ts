import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev overlay badge sits on top of the workspace footer and hides the
  // account menu. It has no place in a screenshot either.
  devIndicators: false,
};

export default nextConfig;
