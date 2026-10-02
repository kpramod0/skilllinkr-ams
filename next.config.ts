import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  // PERF: Enable built-in image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "userpic.codeforces.org" },
      { protocol: "https", hostname: "assets.leetcode.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'skilllinkr.com',
          },
        ],
        destination: 'https://www.skilllinkr.com/:path*',
        permanent: true,
      },
    ];
  },

  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(self \"https://*.supabase.co\" \"https://*.supabase.in\"), payment=(), usb=()" }
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Cache Next.js static chunks very aggressively (immutable, content-hashed)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache public PNG images (logos, icons) for 1 week
        source: "/:path*.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/:path*.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/:path*.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        // API responses: no-cache by default
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

let exportedConfig: any = nextConfig;

if (process.env.NODE_ENV !== "development") {
  const { withSentryConfig } = require("@sentry/nextjs");
  exportedConfig = withSentryConfig(nextConfig, {
    sourcemaps: { disable: true },
    silent: true,
    org: "skilllinkr",
    project: "skilllinkr",
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    disableLogger: true,
  });
}

export default exportedConfig;

