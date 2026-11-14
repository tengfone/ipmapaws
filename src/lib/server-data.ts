import { AWSIPRanges } from '@/types';

const AWS_IP_RANGES_URL = 'https://ip-ranges.amazonaws.com/ip-ranges.json';

/** How long one process reuses a copy before asking AWS again. */
const FRESH_MS = 60 * 60 * 1000;

function isValid(data: unknown): data is AWSIPRanges {
  const d = data as Partial<AWSIPRanges> | null;
  return !!d && Array.isArray(d.prefixes) && Array.isArray(d.ipv6_prefixes) && !!d.syncToken;
}

let memo: { data: AWSIPRanges; at: number } | null = null;
let inFlight: Promise<AWSIPRanges> | null = null;

async function fetchFromAWS(): Promise<AWSIPRanges> {
  // AWS serves this file from its own CDN for exactly this use. It is ~3.6 MB,
  // over Next's 2 MB fetch-cache limit, so it is kept in memory here instead,
  // and the pages and API responses that use it are cached by Vercel's CDN.
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
  return data;
}

/**
 * Loads AWS IP ranges for server components, API routes and build-time
 * generation, straight from AWS with no storage of our own.
 *
 * A process reuses its copy for an hour, and concurrent callers share one
 * download, so a build renders hundreds of pages from a single fetch. If a
 * refresh fails, the last good copy keeps being served rather than an error.
 */
export async function getAWSIPRangesServer(): Promise<AWSIPRanges> {
  if (memo && Date.now() - memo.at < FRESH_MS) return memo.data;
  inFlight ??= fetchFromAWS()
    .then((data) => {
      memo = { data, at: Date.now() };
      return data;
    })
    .catch((error) => {
      if (memo) return memo.data;
      throw error;
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
