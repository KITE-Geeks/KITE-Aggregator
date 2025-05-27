import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repo = 'KITE-Aggregator';
const assetPrefix = isGithubActions ? `/${repo}/` : '';
const basePath = isGithubActions ? `/${repo}` : '';

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Enable static export for GitHub Pages
  output: 'export',
  // Set base path for GitHub Pages
  assetPrefix,
  basePath,
  // Enable React Strict Mode for better development practices
  reactStrictMode: true,
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  // Handle client-side routing
  trailingSlash: true,
};

export default nextConfig;
