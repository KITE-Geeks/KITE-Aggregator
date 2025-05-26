import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [
    "*.csb.app",
    "*.vly.sh",
    "localhost",
    "127.0.0.1",
    "*.vly.ai",
    "vly.ai",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
    unoptimized: true,
  },
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/KITE-Aggregator' : '',
};

export default nextConfig;
