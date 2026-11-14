/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap',
      },
    ];
  },
  // No blanket Cache-Control for /api/*: a next.config header overrides the
  // one a route sets, which made every API response (including 400/429/503)
  // cacheable for an hour. Each route sets its own Cache-Control instead.
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  poweredByHeader: false,
  generateEtags: false,
  compress: true,
  trailingSlash: false,
};

module.exports = nextConfig; 