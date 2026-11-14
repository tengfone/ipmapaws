import { NextRequest, NextResponse } from 'next/server';
import { getAWSIPRangesServer } from '@/lib/server-data';
import { corsPreflight, withCors } from '@/lib/cors';
import {
  getPrefixIndex,
  InvalidLookupQueryError,
  lookupPrefixes,
  normalizeQuery,
} from '@/lib/lookup';
import { lookupRateLimit } from '@/lib/rate-limit';

function errorResponse(
  status: number,
  error: string,
  message: string,
  headers?: Record<string, string>
) {
  return NextResponse.json(
    { error, message, timestamp: new Date().toISOString() },
    { status, headers }
  );
}

/**
 * @swagger
 * /api/aws-ip-ranges/lookup:
 *   get:
 *     summary: Find published AWS prefixes that contain or overlap an IP or CIDR
 *     description: |
 *       Returns the published AWS prefixes that contain the query, most specific first, with the
 *       single most specific one as `bestMatch`. For a CIDR query it also returns the published
 *       prefixes that fall inside the queried range (`contained`, capped at 100; `containedTotal`
 *       has the full count). IPv4-mapped IPv6 addresses (`::ffff:3.5.16.1`) are looked up as IPv4.
 *       Brackets (`[2600::1]`) and IPv6 zone ids (`fe80::1%eth0`) are stripped. IPv4 octets and
 *       prefix lengths with leading zeros are rejected as ambiguous.
 *     tags:
 *       - AWS IP Ranges
 *     parameters:
 *       - $ref: '#/components/parameters/LookupQuery'
 *     responses:
 *       200:
 *         description: Lookup result. `found` is false when no published prefix contains or falls inside the query.
 *         headers:
 *           X-RateLimit-Limit:
 *             description: Requests allowed in the current window (10 requests/minute per IP)
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
 *       500:
 *         $ref: '#/components/responses/InternalError'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
export async function GET(request: NextRequest) {
  const response = await lookupRateLimit(request, async () => {
    const query = new URL(request.url).searchParams.get('q');
    if (query === null || query.trim() === '') {
      return errorResponse(
        400,
        'Invalid query',
        'Query parameter q is required. Enter an IPv4 address, IPv6 address, or CIDR prefix.'
      );
    }

    try {
      // Reject bad input before touching the data store.
      normalizeQuery(query);
    } catch (error) {
      if (error instanceof InvalidLookupQueryError) {
        return errorResponse(400, 'Invalid query', error.message);
      }
      throw error;
    }

    try {
      const awsData = await getAWSIPRangesServer().catch(() => null);
      if (!awsData) {
        return errorResponse(
          503,
          'Data not available yet',
          'Could not load the AWS IP ranges. Please try again in a few moments.',
          { 'Retry-After': '30' }
        );
      }

      const result = lookupPrefixes(getPrefixIndex(awsData), query);

      return NextResponse.json(
        {
          ...result,
          syncToken: awsData.syncToken,
          createDate: awsData.createDate,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            'X-Data-Source': 'AWS IP Ranges API (Server-Side Lookup)',
          },
        }
      );
    } catch (error) {
      console.error('Error in AWS IP ranges lookup API:', error);
      return errorResponse(
        500,
        'Failed to look up AWS IP ranges',
        'An unexpected error occurred. Please try again later.'
      );
    }
  });

  return withCors(response);
}

export async function OPTIONS() {
  return corsPreflight();
}
