import { NextRequest, NextResponse } from 'next/server';

/**
 * Fixed-window, per-IP rate limiting for the public API.
 *
 * Limits live in memory, so on a serverless platform (Vercel) each function
 * instance counts on its own and a cold start resets the count. Treat these
 * limits as best-effort abuse protection, not a guarantee. For hard limits,
 * use a shared store (e.g. Upstash Redis / Vercel KV) or the platform's
 * firewall rate limiting.
 *
 * No request header can switch rate limiting off. Requests that look like
 * they come from this site's own pages (Sec-Fetch-Site / Referer) get a
 * higher, but still finite, per-IP limit. Those headers are client-controlled,
 * so the worst a spoofing client gets is that higher limit.
 */

interface RateLimitOptions {
  /** Namespace for this limiter's counters, so endpoints don't share budgets. */
  name: string;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per IP per window. */
  maxRequests: number;
  /**
   * Requests allowed per IP per window when the request looks like it comes
   * from this site's own pages. Defaults to maxRequests.
   */
  sameSiteMaxRequests?: number;
  /** Message returned in the 429 body. */
  message: string;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

export type RateLimitedHandler = (
  request: NextRequest,
  handler: () => Promise<NextResponse>
) => Promise<NextResponse>;

/** Upper bound on tracked clients per limiter, to bound memory. */
const MAX_TRACKED_CLIENTS = 10_000;

const FIRST_PARTY_HOSTS = new Set(
  [
    'ipmapaws.vercel.app',
    hostOf(process.env.NEXT_PUBLIC_BASE_URL),
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].filter((host): host is string => Boolean(host))
);

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/**
 * True when the browser says the request came from one of this site's pages.
 * Used only to pick the higher limit, never to skip limiting.
 */
export function isSameSiteRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'same-origin') return true;

  const referer = request.headers.get('referer');
  if (!referer) return false;
  try {
    const refererUrl = new URL(referer);
    if (refererUrl.origin === new URL(request.url).origin) return true;
    return FIRST_PARTY_HOSTS.has(refererUrl.host);
  } catch {
    return false;
  }
}

/**
 * Client IP. On Vercel, x-real-ip and x-forwarded-for are set by the platform
 * and cannot be spoofed by the client. Elsewhere they can, so put the app
 * behind a proxy that overwrites them.
 */
export function getClientId(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;

  return 'unknown';
}

export function createRateLimit(options: RateLimitOptions): RateLimitedHandler {
  const { name, windowMs, maxRequests, message } = options;
  const sameSiteMaxRequests = options.sameSiteMaxRequests ?? maxRequests;
  const store = new Map<string, RequestRecord>();
  let lastSweep = Date.now();

  function sweep(now: number) {
    lastSweep = now;
    store.forEach((record, key) => {
      if (now >= record.resetTime) store.delete(key);
    });
    // Still too many live clients: drop the oldest windows first.
    if (store.size > MAX_TRACKED_CLIENTS) {
      const excess = store.size - MAX_TRACKED_CLIENTS;
      const keys = Array.from(store.keys()).slice(0, excess);
      keys.forEach((key) => store.delete(key));
    }
  }

  return async function rateLimit(request, handler) {
    const now = Date.now();
    if (now - lastSweep >= windowMs || store.size > MAX_TRACKED_CLIENTS) {
      sweep(now);
    }

    const clientId = getClientId(request);
    const limit = isSameSiteRequest(request)
      ? sameSiteMaxRequests
      : maxRequests;

    let record = store.get(clientId);
    if (!record || now >= record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      store.set(clientId, record);
    }

    const resetSeconds = Math.ceil(record.resetTime / 1000).toString();
    const windowSeconds = Math.round(windowMs / 1000).toString();

    if (record.count >= limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((record.resetTime - now) / 1000)
      );
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message,
          retryAfter,
          limit,
          windowMs,
          timestamp: new Date(now).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetSeconds,
            'X-RateLimit-Window': windowSeconds,
            'X-RateLimit-Policy': name,
          },
        }
      );
    }

    record.count += 1;

    let response: NextResponse;
    try {
      response = await handler();
    } catch (error) {
      console.error(`[rate-limit:${name}] handler threw:`, error);
      response = NextResponse.json(
        {
          error: 'Internal server error',
          message: 'An unexpected error occurred. Please try again later.',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set(
      'X-RateLimit-Remaining',
      Math.max(0, limit - record.count).toString()
    );
    response.headers.set('X-RateLimit-Reset', resetSeconds);
    response.headers.set('X-RateLimit-Window', windowSeconds);
    response.headers.set('X-RateLimit-Policy', name);
    return response;
  };
}

// Pre-configured limiters. Each has its own counters.
export const apiRateLimit = createRateLimit({
  name: 'dataset',
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  sameSiteMaxRequests: 300,
  message: 'Too many requests for the full dataset. Please try again later.',
});

export const searchRateLimit = createRateLimit({
  name: 'search',
  windowMs: 60 * 1000,
  maxRequests: 10,
  sameSiteMaxRequests: 120,
  message: 'Too many search requests. Please slow down.',
});

export const lookupRateLimit = createRateLimit({
  name: 'lookup',
  windowMs: 60 * 1000,
  maxRequests: 10,
  sameSiteMaxRequests: 30,
  message: 'Too many lookup requests. Please slow down.',
});

export const exportRateLimit = createRateLimit({
  name: 'export',
  windowMs: 10 * 60 * 1000,
  maxRequests: 5,
  sameSiteMaxRequests: 20,
  message:
    'Too many export requests. Please wait before requesting another export.',
});
