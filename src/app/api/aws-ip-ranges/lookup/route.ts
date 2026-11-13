import { NextRequest, NextResponse } from 'next/server';
import { getCachedData } from '@/lib/cache';
import { transformAWSIPRanges } from '@/lib/api';
import {
  InvalidLookupQueryError,
  lookupContainingPrefixes,
} from '@/lib/lookup';
import { searchRateLimit } from '@/lib/rate-limit';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    process.env.NODE_ENV === 'development'
      ? '*'
      : 'https://ipmapaws.vercel.app',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * @swagger
 * /api/aws-ip-ranges/lookup:
 *   get:
 *     summary: Find published AWS prefixes that contain an IP or CIDR
 *     description: Returns every published AWS prefix that contains the query. A single address matches when it falls inside a prefix. A CIDR matches only when the whole range is inside a prefix.
 *     tags:
 *       - AWS IP Ranges
 *     parameters:
 *       - $ref: '#/components/parameters/LookupQuery'
 *     responses:
 *       200:
 *         description: Containing prefixes, or an empty match list when the query is outside the published ranges
 *         headers:
 *           X-RateLimit-Limit:
 *             description: Rate limit threshold (10 requests/minute)
 *             schema:
 *               type: integer
 *           X-RateLimit-Remaining:
 *             description: Remaining requests in current window
 *             schema:
 *               type: integer
 *           X-RateLimit-Reset:
 *             description: Unix timestamp when rate limit resets
 *             schema:
 *               type: integer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupResponse'
 *       400:
 *         description: Query is missing or is not an IPv4 address, IPv6 address, or CIDR
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
export async function GET(request: NextRequest) {
  return searchRateLimit(request, async () => {
    try {
      const awsData = await getCachedData();

      if (!awsData) {
        return NextResponse.json(
          {
            error: 'Data not available yet',
            message:
              'Background sync is initializing. Please try again in a few moments.',
            timestamp: new Date().toISOString(),
          },
          { status: 503 }
        );
      }

      const query = new URL(request.url).searchParams.get('q');
      if (query === null || query.trim() === '') {
        return NextResponse.json(
          {
            error: 'Invalid query',
            message:
              'Query parameter q is required. Enter an IPv4 address, IPv6 address, or CIDR prefix.',
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }

      try {
        const result = lookupContainingPrefixes(
          transformAWSIPRanges(awsData),
          query
        );

        return NextResponse.json(
          {
            query: result.query,
            found: result.found,
            matches: result.matches,
          },
          {
            status: 200,
            headers: {
              'Cache-Control':
                'public, s-maxage=60, stale-while-revalidate=300',
              ...corsHeaders,
              'X-Data-Source': 'AWS IP Ranges API (Server-Side Filtered)',
            },
          }
        );
      } catch (error) {
        if (error instanceof InvalidLookupQueryError) {
          return NextResponse.json(
            {
              error: 'Invalid query',
              message: error.message,
              timestamp: new Date().toISOString(),
            },
            { status: 400 }
          );
        }
        throw error;
      }
    } catch (error) {
      console.error('Error in AWS IP ranges lookup API:', error);

      return NextResponse.json(
        {
          error: 'Failed to look up AWS IP ranges',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NODE_ENV === 'development'
          ? '*'
          : 'https://ipmapaws.vercel.app',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
