import type { NextConfig } from "next";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the dev-tools badge out of Playwright screenshot baselines.
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
