/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';
import { createRateLimit, getClientId, isSameSiteRequest } from '../rate-limit';

const URL_BASE = 'https://ipmapaws.vercel.app/api/aws-ip-ranges/search';

function req(headers: Record<string, string>) {
  return new NextRequest(URL_BASE, { headers });
}

describe('isSameSiteRequest', () => {
  it('trusts Sec-Fetch-Site same-origin and a same-origin Referer', () => {
    expect(isSameSiteRequest(req({ 'sec-fetch-site': 'same-origin' }))).toBe(
      true
    );
    expect(
      isSameSiteRequest(req({ referer: 'https://ipmapaws.vercel.app/docs' }))
    ).toBe(true);
  });

  it('does not match look-alike hosts or other sites', () => {
    expect(
      isSameSiteRequest(
        req({ referer: 'https://ipmapaws.vercel.app.evil.example/' })
      )
    ).toBe(false);
    expect(
      isSameSiteRequest(req({ referer: 'http://localhost.evil.example/' }))
    ).toBe(false);
    expect(isSameSiteRequest(req({ 'sec-fetch-site': 'cross-site' }))).toBe(
      false
    );
    expect(isSameSiteRequest(req({}))).toBe(false);
  });
});

describe('getClientId', () => {
  it('prefers x-real-ip, then the first x-forwarded-for entry', () => {
    expect(
      getClientId(
        req({ 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '198.51.100.1' })
      )
    ).toBe('192.0.2.1');
    expect(
      getClientId(req({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))
    ).toBe('198.51.100.1');
    expect(getClientId(req({ 'cf-connecting-ip': '203.0.113.1' }))).toBe(
      'unknown'
    );
  });
});

describe('createRateLimit', () => {
  const ok = async () => NextResponse.json({ ok: true });

  it('counts per IP and resets after the window', async () => {
    jest.useFakeTimers();
    try {
      const limit = createRateLimit({
        name: 't',
        windowMs: 1000,
        maxRequests: 2,
        message: 'Too many test requests.',
      });
      const a = req({ 'x-real-ip': '192.0.2.1' });
      const b = req({ 'x-real-ip': '192.0.2.2' });

      expect((await limit(a, ok)).status).toBe(200);
      expect((await limit(a, ok)).status).toBe(200);
      const blocked = await limit(a, ok);
      expect(blocked.status).toBe(429);
      expect((await blocked.json()).message).toBe('Too many test requests.');
      expect((await limit(b, ok)).status).toBe(200);

      jest.advanceTimersByTime(1001);
      expect((await limit(a, ok)).status).toBe(200);
    } finally {
      jest.useRealTimers();
    }
  });

  it('turns a thrown handler into a 500 that still carries rate-limit headers', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const limit = createRateLimit({
      name: 't2',
      windowMs: 1000,
      maxRequests: 5,
      message: 'x',
    });
    const response = await limit(req({ 'x-real-ip': '192.0.2.3' }), () =>
      Promise.reject(new Error('boom'))
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('x-ratelimit-remaining')).toBe('4');
    expect(JSON.stringify(await response.json())).not.toContain('boom');
    jest.restoreAllMocks();
  });
});
