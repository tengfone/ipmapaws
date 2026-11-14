import { AWSIPRanges } from '@/types';
import { getCachedData, setCachedData } from '@/lib/cache';

const AWS_IP_RANGES_URL = 'https://ip-ranges.amazonaws.com/ip-ranges.json';

function isValid(data: unknown): data is AWSIPRanges {
  const d = data as Partial<AWSIPRanges> | null;
  return !!d && Array.isArray(d.prefixes) && Array.isArray(d.ipv6_prefixes) && !!d.syncToken;
}

/**
 * Loads AWS IP ranges for server components and build-time generation.
 *
 * Server code must not call this app's own API over HTTP: there is no
 * reliable base URL on Vercel (and none at build time), so it reads the
 * shared cache directly and falls back to AWS.
 */
const MEMO_TTL_MS = 60 * 60 * 1000;
let memo: { data: AWSIPRanges; at: number } | null = null;
let inFlight: Promise<AWSIPRanges> | null = null;

async function load(): Promise<AWSIPRanges> {
  const cached = await getCachedData();
  if (cached) return cached;

  // The file is ~3.6 MB, over Next's 2 MB fetch-cache limit, so skip that
  // cache and memoise in this process instead.
  const response = await fetch(AWS_IP_RANGES_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'IPMapAWS/1.0' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch AWS IP ranges: HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  if (!isValid(data)) {
    throw new Error('Invalid AWS IP ranges response structure');
  }
  setCachedData(data).catch(() => {
    // Caching is best effort; the page still renders with fresh data.
  });
  return data;
}

/**
 * Loads AWS IP ranges for server components and build-time generation.
 *
 * Server code must not call this app's own API over HTTP: there is no
 * reliable base URL on Vercel (and none at build time), so it reads the
 * shared cache directly and falls back to AWS. Results are shared for an
 * hour within a process, so a build renders hundreds of pages from one load.
 */
export async function getAWSIPRangesServer(): Promise<AWSIPRanges> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.data;
  inFlight ??= load()
    .then((data) => {
      memo = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Test helper: forget the in-process copy. */
export function resetServerDataMemo(): void {
  memo = null;
  inFlight = null;
}
