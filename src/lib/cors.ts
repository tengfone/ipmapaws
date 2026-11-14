import { NextResponse } from 'next/server';

const PRODUCTION_ORIGIN = 'https://ipmapaws.vercel.app';

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':
      process.env.NODE_ENV === 'development' ? '*' : PRODUCTION_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers':
      'Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Window',
  };
}

/**
 * Adds CORS headers to any response (including 4xx/5xx, so browsers can read
 * the error body) and keeps error responses out of shared caches: the
 * next.config.js default for /api/* would otherwise let a CDN cache a 429 or
 * 503 and serve it to everyone.
 */
export function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value);
  }
  if (response.status >= 400) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(),
      'Access-Control-Max-Age': '86400',
    },
  });
}
