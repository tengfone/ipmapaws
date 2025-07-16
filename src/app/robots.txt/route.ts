import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ipmapaws.vercel.app';

/**
 * @swagger
 * /robots.txt:
 *   get:
 *     summary: Get robots.txt
 *     description: Returns the robots.txt file for search engine crawlers
 *     tags:
 *       - SEO
 *     responses:
 *       200:
 *         description: Robots.txt content
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
export async function GET() {
  const robots = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${BASE_URL}/sitemap.xml

# Crawl delay for being respectful to the API
Crawl-delay: 1`;

  return new NextResponse(robots, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, s-maxage=86400', // Cache for 24 hours
    },
  });
} 