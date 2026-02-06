/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

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

  // WHY: Skip ESLint + TypeScript during build — they run separately via `npm run lint` and `type-check`
  // WHEN: Every `next build` on Render — saves ~15-30s per deploy
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // TrustedForm needs blob: for workers, Jornaya/LeadID needs its domains, Radar needs multiple domains, Meta/Facebook Pixel needs facebook.net
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.trustedform.com https://*.lidstatic.com https://*.leadid.com https://*.radar.io https://*.radar.com https://radar-verify.com https://*.facebook.net https://connect.facebook.net blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              // Allow connections to TrustedForm, Jornaya/LeadID, Radar, Meta/Facebook (Conversion API), and Sentry
              "connect-src 'self' https://*.radar.io https://*.radar.com https://radar-verify.com https://*.trustedform.com https://*.lidstatic.com https://*.leadid.com https://*.facebook.net https://graph.facebook.com https://*.sentry.io https://*.ingest.sentry.io" + (process.env.NODE_ENV === 'development' ? " wss://localhost:* ws://localhost:*" : ""),
              // Allow iframes for TrustedForm, Jornaya/LeadID, their CDNs, and Facebook
              "frame-src 'self' https://*.trustedform.com https://*.leadid.com https://*.cloudfront.net https://*.facebook.com https://*.facebook.net",
              // TrustedForm uses data: and blob: workers
              "worker-src 'self' blob: data:",
              "object-src 'none'",
              "base-uri 'self'",
              // Jornaya/LeadID and Facebook use form submissions
              "form-action 'self' https://*.leadid.com https://*.facebook.com https://*.facebook.net",
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
      // Legacy service routes → dynamic service page
      // WHY: Backward compatibility for existing bookmarks/links
      // The new /services/[slug] pattern handles all services dynamically
      {
        source: '/windows',
        destination: '/services/windows',
      },
      {
        source: '/roofing',
        destination: '/services/roofing',
      },
      {
        source: '/bathrooms',
        destination: '/services/bathrooms',
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

module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Disabled widenClientFileUpload to speed up builds (~10-20s savings)
  // Standard source maps still upload — only extra client files are skipped
  widenClientFileUpload: false,

  // Disabled component annotation to speed up builds (~5-10s savings)
  // React component names still appear in dev tools, just not in Sentry breadcrumbs
  reactComponentAnnotation: {
    enabled: false,
  },

  // Disabled tunnelRoute to reduce memory usage on 512MB Render instance
  // Client-side Sentry events will go directly to Sentry (may be blocked by ad-blockers)
  // tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
});