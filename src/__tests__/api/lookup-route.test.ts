/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { ipRangesFixture } from '@/__fixtures__/ip-ranges';

jest.mock('@/lib/server-data', () => ({
  getAWSIPRangesServer: jest.fn(),
}));

type RouteModule = typeof import('@/app/api/aws-ip-ranges/lookup/route');

let route: RouteModule;
let getCachedData: jest.Mock;
let ipCounter = 0;

function request(
  query: string | null,
  headers: Record<string, string> = {},
  ip = `198.51.100.${++ipCounter}`
) {
  const url = new URL('https://ipmapaws.vercel.app/api/aws-ip-ranges/lookup');
  if (query !== null) url.searchParams.set('q', query);
  return new NextRequest(url, {
    headers: { 'x-real-ip': ip, ...headers },
  });
}

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // Fresh module state (rate-limit counters, index cache) for every test.
  route = require('@/app/api/aws-ip-ranges/lookup/route');
  getCachedData = require('@/lib/server-data').getAWSIPRangesServer;
  getCachedData.mockReset();
  getCachedData.mockResolvedValue(ipRangesFixture);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function expectCors(response: Response) {
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  expect(response.headers.get('access-control-allow-methods')).toContain('GET');
}

describe('GET /api/aws-ip-ranges/lookup', () => {
  it('returns the ranked result with bestMatch and dataset version', async () => {
    const response = await route.GET(request('3.5.16.1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expectCors(response);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(body).toMatchObject({
      query: '3.5.16.1',
      version: 'ipv4',
      found: true,
      bestMatch: {
        prefix: '3.5.16.0/21',
        service: 'S3',
        region: 'eu-west-1',
        network_border_group: 'eu-west-1',
        type: 'ipv4',
      },
      contained: [],
      containedTotal: 0,
      containedTruncated: false,
      syncToken: ipRangesFixture.syncToken,
      createDate: ipRangesFixture.createDate,
    });
    expect(
      body.containing.map(
        (m: { prefix: string; service: string }) => `${m.prefix} ${m.service}`
      )
    ).toEqual([
      '3.5.16.0/21 S3',
      '3.5.16.0/21 AMAZON',
      '3.5.0.0/16 AMAZON',
      '3.0.0.0/9 AMAZON',
    ]);
  });

  it('reports prefixes inside a broader CIDR', async () => {
    const response = await route.GET(request('3.0.0.0/8'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.found).toBe(true);
    expect(body.bestMatch).toBeNull();
    expect(body.containing).toEqual([]);
    expect(body.containedTotal).toBe(4);
    expect(body.contained[0].prefix).toBe('3.0.0.0/9');
  });

  it('looks up IPv4-mapped IPv6 as IPv4', async () => {
    const response = await route.GET(request('::ffff:305:1001'));
    const body = await response.json();

    expect(body.query).toBe('::ffff:3.5.16.1');
    expect(body.mappedIPv4).toBe('3.5.16.1');
    expect(body.bestMatch.prefix).toBe('3.5.16.0/21');
  });

  it('returns found:false for an address outside the ranges', async () => {
    const response = await route.GET(request('203.0.113.9'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.found).toBe(false);
    expect(body.bestMatch).toBeNull();
  });

  it.each([null, '', '   '])('returns 400 for a missing q (%j)', async (q) => {
    const response = await route.GET(request(q));
    const body = await response.json();

    expect(response.status).toBe(400);
    expectCors(response);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      error: 'Invalid query',
      message: expect.stringContaining('Query parameter q is required'),
      timestamp: expect.any(String),
    });
  });

  it('returns 400 with a truncated echo for invalid input', async () => {
    const junk = `${'z'.repeat(100)}`;
    const response = await route.GET(request(junk));
    const body = await response.json();

    expect(response.status).toBe(400);
    expectCors(response);
    expect(body.error).toBe('Invalid query');
    expect(body.message).not.toContain('z'.repeat(65));
  });

  it('validates input before reading the data store', async () => {
    getCachedData.mockResolvedValue(null);
    const response = await route.GET(request('010.1.2.3'));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/leading zero/);
    expect(getCachedData).not.toHaveBeenCalled();
  });

  it('returns 503 with CORS when data is not available', async () => {
    getCachedData.mockResolvedValue(null);
    const response = await route.GET(request('3.5.16.1'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expectCors(response);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.error).toBe('Data not available yet');
  });

  it('returns 503 without leaking details when loading the data fails', async () => {
    getCachedData.mockRejectedValue(new Error('secret internal detail'));
    const response = await route.GET(request('3.5.16.1'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expectCors(response);
    expect(JSON.stringify(body)).not.toContain('secret internal detail');
  });

  it('sets rate-limit headers', async () => {
    const response = await route.GET(request('3.5.16.1'));

    expect(response.headers.get('x-ratelimit-limit')).toBe('10');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('9');
    expect(response.headers.get('x-ratelimit-reset')).toMatch(/^\d+$/);
    expect(response.headers.get('x-ratelimit-policy')).toBe('lookup');
  });

  it('returns 429 with CORS after the limit, and headers cannot bypass it', async () => {
    const ip = '192.0.2.77';
    const bypassAttempt = {
      'x-internal-request': 'true',
      'user-agent': 'Next.js Middleware',
    };
    for (let i = 0; i < 10; i += 1) {
      const ok = await route.GET(request('3.5.16.1', bypassAttempt, ip));
      expect(ok.status).toBe(200);
    }

    const limited = await route.GET(request('3.5.16.1', bypassAttempt, ip));
    const body = await limited.json();

    expect(limited.status).toBe(429);
    expectCors(limited);
    expect(limited.headers.get('cache-control')).toBe('no-store');
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(limited.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(body.message).toMatch(/lookup/i);
    expect(body.message).not.toMatch(/search/i);
  });

  it('gives same-site requests a higher but finite limit', async () => {
    const ip = '192.0.2.88';
    const sameSite = { 'sec-fetch-site': 'same-origin' };
    const first = await route.GET(request('3.5.16.1', sameSite, ip));
    expect(first.headers.get('x-ratelimit-limit')).toBe('30');

    for (let i = 1; i < 30; i += 1) {
      await route.GET(request('3.5.16.1', sameSite, ip));
    }
    const limited = await route.GET(request('3.5.16.1', sameSite, ip));
    expect(limited.status).toBe(429);
  });

  it('does not share its budget with the search endpoint', async () => {
    const ip = '192.0.2.99';
    const { searchRateLimit } = require('@/lib/rate-limit');
    const { NextResponse } = require('next/server');
    for (let i = 0; i < 10; i += 1) {
      await searchRateLimit(request('x', {}, ip), async () =>
        NextResponse.json({})
      );
    }

    const response = await route.GET(request('3.5.16.1', {}, ip));
    expect(response.status).toBe(200);
  });

  it('answers CORS preflight', async () => {
    const response = await route.OPTIONS();

    expect(response.status).toBe(204);
    expectCors(response);
    expect(response.headers.get('access-control-max-age')).toBe('86400');
  });
});
