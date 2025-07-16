import { NextRequest, NextResponse } from 'next/server';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  bypassInternal?: boolean; // Bypass rate limiting for internal website requests
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// In production, you might want to use Redis or another persistent store
const store = new Map<string, RequestRecord>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(store.entries());
  for (const [key, record] of entries) {
    if (now > record.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Determines if a request is from the internal website
 * This checks various indicators to distinguish internal vs external API usage
 */
function isInternalRequest(request: NextRequest): boolean {
  // Check for internal bypass header (we'll add this to our internal requests)
  const internalHeader = request.headers.get('x-internal-request');
  if (internalHeader === 'true') {
    return true;
  }

  // Check referer header - internal requests should come from our domain
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const requestUrl = new URL(request.url);
      
      // If referer is from the same domain, it's likely an internal request
      if (refererUrl.origin === requestUrl.origin) {
        return true;
      }

      // Check for common development/production domains
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/https?:\/\//, '');
      const internalDomains = [
        'localhost',
        '127.0.0.1',
        'ipmapaws.vercel.app',
        ...(baseUrl ? [baseUrl] : [])
      ];

      if (internalDomains.some(domain => refererUrl.hostname.includes(domain))) {
        return true;
      }
    } catch (e) {
      // Invalid referer URL, continue to other checks
    }
  }

  // Check User-Agent for Next.js internal requests
  const userAgent = request.headers.get('user-agent') || '';
  if (userAgent.includes('Next.js') || userAgent.includes('node-fetch')) {
    return true;
  }

  // If request has no referer and no external indicators, might be internal
  if (!referer && !userAgent.includes('curl') && !userAgent.includes('Postman')) {
    return true;
  }

  return false;
}

export function createRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    bypassInternal = true, // Default to bypassing internal requests
  } = options;

  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Check if this is an internal request and should bypass rate limiting
    if (bypassInternal && isInternalRequest(request)) {
      // Skip rate limiting for internal requests but still process normally
      return handler();
    }

    // Get client identifier (IP address)
    const clientId = getClientId(request);
    const now = Date.now();
    
    // Get or create record for this client
    let record = store.get(clientId);
    
    if (!record || now > record.resetTime) {
      // Create new record or reset expired one
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(clientId, record);
    }

    // Check if limit exceeded
    if (record.count >= maxRequests) {
      const resetTimeSeconds = Math.ceil((record.resetTime - now) / 1000);
      
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message,
          retryAfter: resetTimeSeconds,
          limit: maxRequests,
          windowMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': resetTimeSeconds.toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(record.resetTime / 1000).toString(),
            'X-RateLimit-Window': (windowMs / 1000).toString(),
          },
        }
      );
    }

    // Increment counter before processing request
    if (!skipSuccessfulRequests && !skipFailedRequests) {
      record.count++;
    }

    // Process the request
    let response: NextResponse;
    let shouldCount = true;

    try {
      response = await handler();
      
      // Check if we should count this request
      if (skipSuccessfulRequests && response.status < 400) {
        shouldCount = false;
      }
    } catch (error) {
      // Handle errors
      response = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
      
      if (skipFailedRequests) {
        shouldCount = false;
      }
    }

    // Update counter based on response
    if ((skipSuccessfulRequests || skipFailedRequests) && !shouldCount) {
      record.count--;
    }

    // Add rate limit headers to response
    const remaining = Math.max(0, maxRequests - record.count);
    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
    response.headers.set('X-RateLimit-Window', (windowMs / 1000).toString());

    return response;
  };
}

function getClientId(request: NextRequest): string {
  // Try to get real IP from various headers (for proxies/CDNs)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback for cases where IP cannot be determined
  return 'unknown';
}

// Pre-configured rate limiters for different API endpoints
export const apiRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 requests per hour
  message: 'Too many API requests. Please try again later.',
  bypassInternal: true, // Allow internal website requests
});

export const searchRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 searches per minute
  message: 'Too many search requests. Please slow down.',
  bypassInternal: true, // Allow internal website requests
});

export const exportRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 5, // 5 exports per 10 minutes
  message: 'Too many export requests. Please wait before requesting another export.',
  bypassInternal: true, // Allow internal website requests
}); 