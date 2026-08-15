// next.config.cjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },

  reactStrictMode: true,
  swcMinify: true,

  images: {
    domains: [
      'assets.coingecko.com',
      'raw.githubusercontent.com',
      'ipfs.io',
      'gateway.pinata.cloud',
      'arweave.net',
    ],
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, immutable' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      const { DefinePlugin } = require('webpack');
      config.plugins.push(
        new DefinePlugin({
          'process.env.NEXT_PUBLIC_BUILD_TIME': JSON.stringify(new Date().toISOString()),
          'process.env.NEXT_PUBLIC_BUILD_VERSION': JSON.stringify(`v2.0-${Date.now()}`),
        })
      );
    }
    return config;
  },

  async redirects() {
    return [];
  },

  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;