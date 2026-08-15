// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Generate unique build ID to bust cache
  generateBuildId: async () => {
    // This will create a unique build ID based on timestamp
    // This forces a new build ID on every deployment
    return `build-${Date.now()}`;
  },

  // Disable React strict mode if causing issues (optional)
  reactStrictMode: true,

  // Enable SWC minification for faster builds
  swcMinify: true,

  // Image optimization settings
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

  // Headers to control caching
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // But allow static assets to be cached
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Allow images to be cached
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, immutable',
          },
        ],
      },
    ];
  },

  // Webpack configuration for better debugging
  webpack: (config, { isServer, dev }) => {
    // Add build timestamp to the client bundle
    if (!isServer) {
      // Use dynamic import for webpack to avoid module issues
      const webpack = await import('webpack');
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.NEXT_PUBLIC_BUILD_TIME': JSON.stringify(new Date().toISOString()),
          'process.env.NEXT_PUBLIC_BUILD_VERSION': JSON.stringify(`v2.0-${Date.now()}`),
        })
      );
    }
    return config;
  },

  // Optional: Add redirects if needed
  async redirects() {
    return [];
  },

  // Optional: Add rewrites if needed
  async rewrites() {
    return [];
  },
};

export default nextConfig;