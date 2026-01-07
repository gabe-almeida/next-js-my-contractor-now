/** @type {import('next').NextConfig} */

// Generate a random nonce for CSP (simplified approach for Next.js)
function generateNonce() {
  return Math.random().toString(36).substring(2, 15);
}

const nextConfig = {
  // Standalone output for reduced memory footprint (important for Render Starter plan)
  output: 'standalone',

  // Transpile recharts for proper ESM handling
  transpilePackages: ['recharts', 'react-smooth', 'd3-scale', 'd3-shape'],

  // Exclude problematic packages from server-side bundling
  experimental: {
    serverComponentsExternalPackages: ['rate-limiter-flexible'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.trustedform.com https://*.lidstatic.com https://api.radar.io",
              "style-src 'self' 'unsafe-inline'", // Required for styled-components and Tailwind
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.radar.io https://*.trustedform.com https://*.lidstatic.com" + (process.env.NODE_ENV === 'development' ? " wss://localhost:* ws://localhost:*" : ""),
              "frame-src 'self' https://*.trustedform.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Strict-Transport-Security',
            value: process.env.NODE_ENV === 'production' ? 
              'max-age=63072000; includeSubDomains; preload' : 
              'max-age=0' // Disable in development
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/ws',
        destination: '/api/websocket',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Ignore .d.ts files from rate-limiter-flexible to prevent parsing errors
    config.module.rules.push({
      test: /\.d\.ts$/,
      include: /node_modules\/rate-limiter-flexible/,
      use: 'ignore-loader',
    });

    return config;
  },
};

module.exports = nextConfig;