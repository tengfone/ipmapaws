import { transformAWSIPRanges } from '@/lib/api';
import { AWSIPRanges, CombinedPrefix } from '@/types';

/**
 * "Which published AWS prefix contains this IP or CIDR?"
 *
 * The same code runs on the server (the /api/aws-ip-ranges/lookup route) and
 * in the browser (the PrefixLookup component works on the dataset the home
 * page has already downloaded), so results are identical in both places.
 */

export class InvalidLookupQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLookupQueryError';
    Object.setPrototypeOf(this, InvalidLookupQueryError.prototype);
  }
}

export interface PrefixLookupResult {
  /** The query in canonical form (RFC 5952 for IPv6, host bits cleared for CIDRs). */
  query: string;
  /** Address family the lookup ran against. An IPv4-mapped IPv6 query runs as IPv4. */
  version: 'ipv4' | 'ipv6';
  /** For an IPv4-mapped IPv6 query (::ffff:a.b.c.d), the IPv4 address or CIDR it was looked up as. */
  mappedIPv4?: string;
  /** True when at least one published prefix contains the query or falls inside it. */
  found: boolean;
  /** The most specific published prefix that contains the whole query, if any. */
  bestMatch: CombinedPrefix | null;
  /** Published prefixes that contain the whole query, most specific first. */
  containing: CombinedPrefix[];
  /** Published prefixes strictly inside the queried range, in address order, capped at containedLimit. */
  contained: CombinedPrefix[];
  /** Total number of published prefixes inside the queried range before the cap. */
  containedTotal: number;
  /** True when `contained` was cut off at the cap. */
  containedTruncated: boolean;
}

export interface LookupOptions {
  /** Maximum number of `contained` prefixes to return. Defaults to 100. */
  containedLimit?: number;
}

export const DEFAULT_CONTAINED_LIMIT = 100;
export const MAX_QUERY_LENGTH = 128;
const ERROR_ECHO_LENGTH = 64;

type Hextets = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

type ParsedAddress =
  | {
      version: 'ipv4';
      network: number;
      prefixLength: number;
    }
  | {
      version: 'ipv6';
      network: Hextets;
      prefixLength: number;
    };

interface ParsedQuery {
  /** What the lookup runs against (already unwrapped for IPv4-mapped input). */
  address: ParsedAddress;
  /** Canonical rendering of what the user typed. */
  normalized: string;
  /** Set when an IPv4-mapped IPv6 address was unwrapped. */
  mappedIPv4?: string;
}

interface IndexedPrefix<T extends ParsedAddress> {
  parsed: T;
  entry: CombinedPrefix;
  serviceRank: number;
}

type V4Indexed = IndexedPrefix<Extract<ParsedAddress, { version: 'ipv4' }>>;
type V6Indexed = IndexedPrefix<Extract<ParsedAddress, { version: 'ipv6' }>>;

/**
 * Parsed and pre-sorted dataset. Build it once per dataset version and reuse
 * it for every lookup; parsing ~10k prefixes per request is the expensive part.
 */
export interface PrefixIndex {
  readonly ipv4: readonly V4Indexed[];
  readonly ipv6: readonly V6Indexed[];
  /** Number of dataset rows that could not be parsed and were skipped. */
  readonly skipped: number;
}

const IPV4_MAX_PREFIX = 32;
const IPV6_MAX_PREFIX = 128;
const IPV6_GROUP_COUNT = 8;
const IPV4_MAPPED_PREFIX = 96;

/* ------------------------------------------------------------------------ */
/* Public API                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Parses and sorts dataset rows so lookups only compare numbers.
 * Rows that are not valid prefixes, or whose `type` disagrees with the
 * address family, are skipped rather than failing every lookup.
 */
export function buildPrefixIndex(
  prefixes: readonly CombinedPrefix[]
): PrefixIndex {
  const ipv4: V4Indexed[] = [];
  const ipv6: V6Indexed[] = [];
  let skipped = 0;

  for (const entry of prefixes) {
    const parsed = tryParseDatasetPrefix(entry);
    if (!parsed) {
      skipped += 1;
      continue;
    }
    const serviceRank = entry.service === 'AMAZON' ? 1 : 0;
    if (parsed.version === 'ipv4') {
      ipv4.push({ parsed, entry, serviceRank });
    } else {
      ipv6.push({ parsed, entry, serviceRank });
    }
  }

  ipv4.sort(compareSpecificity);
  ipv6.sort(compareSpecificity);

  return { ipv4, ipv6, skipped };
}

let cachedIndex: { key: string; index: PrefixIndex } | null = null;

/**
 * Returns the index for an AWS ip-ranges.json document, rebuilding it only
 * when the dataset version (syncToken + createDate) changes.
 */
export function getPrefixIndex(data: AWSIPRanges): PrefixIndex {
  const key = `${data.syncToken}|${data.createDate}`;
  if (cachedIndex && cachedIndex.key === key) {
    return cachedIndex.index;
  }
  const index = buildPrefixIndex(transformAWSIPRanges(data));
  cachedIndex = { key, index };
  return index;
}

/**
 * Looks up a query against a prebuilt index.
 *
 * - `containing`: published prefixes that contain the whole query, most
 *   specific first (longest prefix, then a named service before the
 *   AMAZON aggregate, then region). `bestMatch` is the first of these.
 * - `contained`: for a CIDR query, published prefixes that sit strictly
 *   inside it (e.g. 3.0.0.0/8 contains the published 3.0.0.0/9).
 *
 * Throws InvalidLookupQueryError for input that is not an IP or CIDR.
 */
export function lookupPrefixes(
  index: PrefixIndex,
  rawQuery: string,
  options: LookupOptions = {}
): PrefixLookupResult {
  const limit = Math.max(0, options.containedLimit ?? DEFAULT_CONTAINED_LIMIT);
  const parsed = parseQuery(rawQuery);
  const query = parsed.address;

  const containing: CombinedPrefix[] = [];
  const containedIndexed: Array<V4Indexed | V6Indexed> = [];

  if (query.version === 'ipv4') {
    for (const candidate of index.ipv4) {
      if (containsV4(candidate.parsed, query)) {
        containing.push(candidate.entry);
      } else if (containsV4(query, candidate.parsed)) {
        containedIndexed.push(candidate);
      }
    }
  } else {
    for (const candidate of index.ipv6) {
      if (containsV6(candidate.parsed, query)) {
        containing.push(candidate.entry);
      } else if (containsV6(query, candidate.parsed)) {
        containedIndexed.push(candidate);
      }
    }
  }

  containedIndexed.sort(compareAddressOrder);
  const contained = containedIndexed
    .slice(0, limit)
    .map((candidate) => candidate.entry);

  return {
    query: parsed.normalized,
    version: query.version,
    ...(parsed.mappedIPv4 ? { mappedIPv4: parsed.mappedIPv4 } : {}),
    found: containing.length > 0 || containedIndexed.length > 0,
    bestMatch: containing[0] ?? null,
    containing,
    contained,
    containedTotal: containedIndexed.length,
    containedTruncated: containedIndexed.length > contained.length,
  };
}

/**
 * Convenience wrapper that builds a throwaway index. Prefer
 * buildPrefixIndex/getPrefixIndex + lookupPrefixes for repeated lookups.
 */
export function lookupContainingPrefixes(
  prefixes: readonly CombinedPrefix[],
  rawQuery: string,
  options?: LookupOptions
): PrefixLookupResult {
  return lookupPrefixes(buildPrefixIndex(prefixes), rawQuery, options);
}

/**
 * Validates and canonicalizes an IP or CIDR. Throws InvalidLookupQueryError.
 */
export function normalizeQuery(rawQuery: string): string {
  return parseQuery(rawQuery).normalized;
}

/**
 * Strict CIDR check: an explicit prefix length is required, and brackets,
 * zone ids and surrounding whitespace are not accepted.
 */
export function isValidCidr(value: string): boolean {
  if (typeof value !== 'string' || !value.includes('/')) return false;
  if (value !== value.trim() || /[[\]%]/.test(value)) return false;
  try {
    parseQuery(value);
    return true;
  } catch (error) {
    if (error instanceof InvalidLookupQueryError) return false;
    throw error;
  }
}

/* ------------------------------------------------------------------------ */
/* Ordering                                                                 */
/* ------------------------------------------------------------------------ */

function compareSpecificity(
  a: V4Indexed | V6Indexed,
  b: V4Indexed | V6Indexed
): number {
  return (
    b.parsed.prefixLength - a.parsed.prefixLength ||
    a.serviceRank - b.serviceRank ||
    compareText(a.entry.service, b.entry.service) ||
    compareText(a.entry.region, b.entry.region) ||
    compareText(a.entry.network_border_group, b.entry.network_border_group)
  );
}

function compareAddressOrder(
  a: V4Indexed | V6Indexed,
  b: V4Indexed | V6Indexed
): number {
  return (
    compareNetworks(a.parsed, b.parsed) ||
    a.parsed.prefixLength - b.parsed.prefixLength ||
    a.serviceRank - b.serviceRank ||
    compareText(a.entry.service, b.entry.service) ||
    compareText(a.entry.region, b.entry.region)
  );
}

function compareNetworks(a: ParsedAddress, b: ParsedAddress): number {
  if (a.version === 'ipv4' && b.version === 'ipv4') {
    return a.network - b.network;
  }
  if (a.version === 'ipv6' && b.version === 'ipv6') {
    for (let i = 0; i < IPV6_GROUP_COUNT; i += 1) {
      const diff = a.network[i] - b.network[i];
      if (diff !== 0) return diff;
    }
  }
  return 0;
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/* ------------------------------------------------------------------------ */
/* Containment                                                              */
/* ------------------------------------------------------------------------ */

function containsV4(
  outer: Extract<ParsedAddress, { version: 'ipv4' }>,
  inner: Extract<ParsedAddress, { version: 'ipv4' }>
): boolean {
  if (inner.prefixLength < outer.prefixLength) return false;
  return maskV4(inner.network, outer.prefixLength) === outer.network;
}

function containsV6(
  outer: Extract<ParsedAddress, { version: 'ipv6' }>,
  inner: Extract<ParsedAddress, { version: 'ipv6' }>
): boolean {
  if (inner.prefixLength < outer.prefixLength) return false;
  const masked = maskV6(inner.network, outer.prefixLength);
  for (let i = 0; i < IPV6_GROUP_COUNT; i += 1) {
    if (masked[i] !== outer.network[i]) return false;
  }
  return true;
}

/* ------------------------------------------------------------------------ */
/* Parsing                                                                  */
/* ------------------------------------------------------------------------ */

function tryParseDatasetPrefix(entry: CombinedPrefix): ParsedAddress | null {
  try {
    const { address, mappedIPv4 } = parseQuery(entry.prefix);
    if (mappedIPv4 || address.version !== entry.type) return null;
    return address;
  } catch (error) {
    if (error instanceof InvalidLookupQueryError) return null;
    throw error;
  }
}

function echo(value: string): string {
  return value.length > ERROR_ECHO_LENGTH
    ? `${value.slice(0, ERROR_ECHO_LENGTH)}…`
    : value;
}

function parseQuery(rawQuery: string): ParsedQuery {
  const trimmed = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  const fail = (reason?: string): never => {
    if (!trimmed) {
      throw new InvalidLookupQueryError(
        'Enter an IPv4 address, IPv6 address, or CIDR prefix.'
      );
    }
    throw new InvalidLookupQueryError(
      reason
        ? `Invalid IP or CIDR "${echo(trimmed)}": ${reason}.`
        : `Invalid IP or CIDR "${echo(trimmed)}". Enter an IPv4 address, IPv6 address, or CIDR prefix.`
    );
  };

  if (!trimmed) fail();
  if (trimmed.length > MAX_QUERY_LENGTH) {
    fail(`input is longer than ${MAX_QUERY_LENGTH} characters`);
  }
  if (/\s/.test(trimmed)) fail();

  let rest = trimmed;
  let lengthText: string | null = null;

  const slash = rest.indexOf('/');
  if (slash !== -1) {
    if (rest.indexOf('/', slash + 1) !== -1) fail();
    lengthText = rest.slice(slash + 1);
    rest = rest.slice(0, slash);
  }

  // [2600::1] or [2600::1]/64 (URL-style brackets around an IPv6 address).
  if (rest.startsWith('[') || rest.endsWith(']')) {
    if (!(rest.startsWith('[') && rest.endsWith(']'))) fail();
    rest = rest.slice(1, -1);
    if (!rest.includes(':')) fail();
  }

  // fe80::1%eth0: the zone id only scopes a link-local address to an
  // interface on one host, so it has no bearing on which prefix contains it.
  const percent = rest.indexOf('%');
  if (percent !== -1) {
    if (!rest.includes(':') || percent === rest.length - 1) fail();
    rest = rest.slice(0, percent);
  }

  if (!rest) fail();

  let explicitLength: number | null = null;
  if (lengthText !== null) {
    if (!/^\d{1,3}$/.test(lengthText)) fail();
    if (lengthText.length > 1 && lengthText.startsWith('0')) {
      fail(`prefix length "/${lengthText}" has a leading zero`);
    }
    explicitLength = Number(lengthText);
  }

  if (rest.includes(':')) {
    return parseIPv6Query(rest, explicitLength, fail);
  }

  const ipv4 = parseIPv4(rest, fail);
  const prefixLength = explicitLength ?? IPV4_MAX_PREFIX;
  if (prefixLength > IPV4_MAX_PREFIX) {
    fail(`IPv4 prefix length must be between 0 and ${IPV4_MAX_PREFIX}`);
  }
  const network = maskV4(ipv4, prefixLength);
  const rendered = formatIPv4(explicitLength === null ? ipv4 : network);
  return {
    address: { version: 'ipv4', network, prefixLength },
    normalized:
      explicitLength === null ? rendered : `${rendered}/${prefixLength}`,
  };
}

function parseIPv6Query(
  text: string,
  explicitLength: number | null,
  fail: (reason?: string) => never
): ParsedQuery {
  const hextets = parseIPv6(text, fail);
  const prefixLength = explicitLength ?? IPV6_MAX_PREFIX;
  if (prefixLength > IPV6_MAX_PREFIX) {
    fail(`IPv6 prefix length must be between 0 and ${IPV6_MAX_PREFIX}`);
  }
  const network = maskV6(hextets, prefixLength);
  const shown = explicitLength === null ? hextets : network;
  const suffix = explicitLength === null ? '' : `/${prefixLength}`;
  const normalized = `${formatIPv6(shown)}${suffix}`;

  // ::ffff:a.b.c.d is an IPv4 address carried in IPv6 (RFC 4291 2.5.5.2).
  // Look it up as the IPv4 address it wraps.
  if (isIPv4Mapped(hextets) && prefixLength >= IPV4_MAPPED_PREFIX) {
    const ipv4Network = ((network[6] << 16) | network[7]) >>> 0;
    const ipv4Length = prefixLength - IPV4_MAPPED_PREFIX;
    const ipv4Text = formatIPv4(
      explicitLength === null
        ? ((hextets[6] << 16) | hextets[7]) >>> 0
        : ipv4Network
    );
    return {
      address: {
        version: 'ipv4',
        network: ipv4Network,
        prefixLength: ipv4Length,
      },
      normalized,
      mappedIPv4:
        explicitLength === null ? ipv4Text : `${ipv4Text}/${ipv4Length}`,
    };
  }

  return {
    address: { version: 'ipv6', network, prefixLength },
    normalized,
  };
}

function parseIPv4(address: string, fail: (reason?: string) => never): number {
  const parts = address.split('.');
  if (parts.length !== 4) fail();

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) fail();
    if (part.length > 1 && part.startsWith('0')) {
      fail(
        `IPv4 octet "${part}" has a leading zero, which is ambiguous (some tools read it as octal). Remove the leading zeros`
      );
    }
    const octet = Number(part);
    if (octet > 255) fail(`IPv4 octet "${part}" is greater than 255`);
    value = (value * 256 + octet) >>> 0;
  }

  return value;
}

function formatIPv4(ip: number): string {
  return [
    (ip >>> 24) & 255,
    (ip >>> 16) & 255,
    (ip >>> 8) & 255,
    ip & 255,
  ].join('.');
}

function maskV4(ip: number, prefixLength: number): number {
  if (prefixLength <= 0) return 0;
  if (prefixLength >= IPV4_MAX_PREFIX) return ip >>> 0;
  const mask = (0xffffffff << (IPV4_MAX_PREFIX - prefixLength)) >>> 0;
  return (ip & mask) >>> 0;
}

function parseIPv6(address: string, fail: (reason?: string) => never): Hextets {
  if (address.split('::').length > 2) fail();

  const compressed = address.includes('::');
  let head: string[];
  let tail: string[];

  if (compressed) {
    const [rawHead, rawTail] = address.split('::');
    head = rawHead ? rawHead.split(':') : [];
    tail = rawTail ? rawTail.split(':') : [];
    head = expandEmbeddedV4(head, false, fail);
    tail = expandEmbeddedV4(tail, tail.length > 0, fail);
  } else {
    head = expandEmbeddedV4(address.split(':'), true, fail);
    tail = [];
  }

  const present = head.length + tail.length;
  if (compressed) {
    if (present > IPV6_GROUP_COUNT - 1) fail();
  } else if (present !== IPV6_GROUP_COUNT) {
    fail();
  }

  const zeroCount = IPV6_GROUP_COUNT - present;
  const groups = [
    ...head.map((part) => parseHextet(part, fail)),
    ...Array.from({ length: zeroCount }, () => 0),
    ...tail.map((part) => parseHextet(part, fail)),
  ];

  if (groups.length !== IPV6_GROUP_COUNT) fail();

  return asHextets(groups);
}

function expandEmbeddedV4(
  parts: string[],
  allowAtEnd: boolean,
  fail: (reason?: string) => never
): string[] {
  const dottedIndex = parts.findIndex((part) => part.includes('.'));
  if (dottedIndex === -1) return parts;
  if (!allowAtEnd || dottedIndex !== parts.length - 1) fail();

  const ipv4 = parseIPv4(parts[dottedIndex], fail);
  const high = ((ipv4 >>> 16) & 0xffff).toString(16);
  const low = (ipv4 & 0xffff).toString(16);
  return [...parts.slice(0, -1), high, low];
}

function parseHextet(part: string, fail: (reason?: string) => never): number {
  if (!/^[0-9a-fA-F]{1,4}$/.test(part)) fail();
  return parseInt(part, 16);
}

function isIPv4Mapped(value: Hextets): boolean {
  return (
    value[0] === 0 &&
    value[1] === 0 &&
    value[2] === 0 &&
    value[3] === 0 &&
    value[4] === 0 &&
    value[5] === 0xffff
  );
}

function maskV6(ip: Hextets, prefixLength: number): Hextets {
  if (prefixLength >= IPV6_MAX_PREFIX) {
    return asHextets([...ip]);
  }

  const groups = [0, 0, 0, 0, 0, 0, 0, 0];
  if (prefixLength <= 0) return asHextets(groups);

  const fullGroups = Math.floor(prefixLength / 16);
  const remainingBits = prefixLength % 16;

  for (let index = 0; index < fullGroups; index += 1) {
    groups[index] = ip[index];
  }

  if (remainingBits > 0) {
    const mask = (0xffff << (16 - remainingBits)) & 0xffff;
    groups[fullGroups] = ip[fullGroups] & mask;
  }

  return asHextets(groups);
}

function asHextets(groups: number[]): Hextets {
  return [
    groups[0],
    groups[1],
    groups[2],
    groups[3],
    groups[4],
    groups[5],
    groups[6],
    groups[7],
  ];
}

/**
 * RFC 5952 text form: lowercase, no leading zeros, the longest run of two or
 * more zero groups (first one on a tie) compressed to "::", and IPv4-mapped
 * addresses written with a dotted-quad tail (section 5).
 */
function formatIPv6(value: Hextets): string {
  if (isIPv4Mapped(value)) {
    return `::ffff:${formatIPv4(((value[6] << 16) | value[7]) >>> 0)}`;
  }

  const groups = value.map((group) => group.toString(16));
  let bestStart = -1;
  let bestLength = 0;
  let index = 0;

  while (index < groups.length) {
    if (groups[index] !== '0') {
      index += 1;
      continue;
    }

    const start = index;
    while (index < groups.length && groups[index] === '0') {
      index += 1;
    }

    const length = index - start;
    if (length > bestLength) {
      bestStart = start;
      bestLength = length;
    }
  }

  if (bestLength < 2) return groups.join(':');

  const head = groups.slice(0, bestStart).join(':');
  const tail = groups.slice(bestStart + bestLength).join(':');
  return `${head}::${tail}`;
}
