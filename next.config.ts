import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: [],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // ✅ Remove eslint from here - it's no longer supported
};

export default nextConfig;