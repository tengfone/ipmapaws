import { CombinedPrefix } from '@/types';

export class InvalidLookupQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLookupQueryError';
    Object.setPrototypeOf(this, InvalidLookupQueryError.prototype);
  }
}

export interface PrefixLookupResult {
  query: string;
  found: boolean;
  matches: CombinedPrefix[];
}

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
      normalized: string;
    }
  | {
      version: 'ipv6';
      network: Hextets;
      prefixLength: number;
      normalized: string;
    };

const IPV4_MAX_PREFIX = 32;
const IPV6_MAX_PREFIX = 128;
const IPV6_GROUP_COUNT = 8;

/**
 * Returns every published prefix that contains the query.
 * A single address matches when it falls inside the prefix.
 * A CIDR matches only when its whole range is inside the prefix.
 * Throws InvalidLookupQueryError for input that is not an IP or CIDR.
 */
export function lookupContainingPrefixes(
  prefixes: readonly CombinedPrefix[],
  rawQuery: string
): PrefixLookupResult {
  const query = parseQuery(rawQuery);
  const matches: CombinedPrefix[] = [];

  for (const entry of prefixes) {
    const candidate = tryParseDatasetPrefix(entry);
    if (!candidate) continue;
    if (contains(candidate, query)) {
      matches.push(entry);
    }
  }

  return {
    query: query.normalized,
    found: matches.length > 0,
    matches,
  };
}

function tryParseDatasetPrefix(entry: CombinedPrefix): ParsedAddress | null {
  try {
    const parsed = parseQuery(entry.prefix);
    if (parsed.version !== entry.type) return null;
    return parsed;
  } catch (error) {
    if (error instanceof InvalidLookupQueryError) return null;
    throw error;
  }
}

function contains(candidate: ParsedAddress, query: ParsedAddress): boolean {
  if (candidate.version === 'ipv4' && query.version === 'ipv4') {
    if (query.prefixLength < candidate.prefixLength) return false;
    return maskV4(query.network, candidate.prefixLength) === candidate.network;
  }

  if (candidate.version === 'ipv6' && query.version === 'ipv6') {
    if (query.prefixLength < candidate.prefixLength) return false;
    const masked = maskV6(query.network, candidate.prefixLength);
    return masked.every((group, index) => group === candidate.network[index]);
  }

  return false;
}

function parseQuery(rawQuery: string): ParsedAddress {
  const trimmed = rawQuery.trim();
  const fail = (): never => {
    throw new InvalidLookupQueryError(
      trimmed
        ? `Invalid IP or CIDR "${trimmed}". Enter an IPv4 address, IPv6 address, or CIDR prefix.`
        : 'Enter an IPv4 address, IPv6 address, or CIDR prefix.'
    );
  };

  if (!trimmed || trimmed.length > 128 || /\s/.test(trimmed)) fail();

  const slash = trimmed.indexOf('/');
  let address = trimmed;
  let explicitLength: number | null = null;

  if (slash !== -1) {
    if (trimmed.indexOf('/', slash + 1) !== -1) fail();
    address = trimmed.slice(0, slash);
    const lengthText = trimmed.slice(slash + 1);
    if (!/^\d{1,3}$/.test(lengthText)) fail();
    explicitLength = Number(lengthText);
    if (!address) fail();
  }

  if (address.includes(':')) {
    const hextets = parseIPv6(address, fail);
    const prefixLength = explicitLength ?? IPV6_MAX_PREFIX;
    if (prefixLength > IPV6_MAX_PREFIX) fail();
    const network = maskV6(hextets, prefixLength);
    const rendered = formatIPv6(explicitLength === null ? hextets : network);
    return {
      version: 'ipv6',
      network,
      prefixLength,
      normalized:
        explicitLength === null ? rendered : `${rendered}/${prefixLength}`,
    };
  }

  const ipv4 = parseIPv4(address, fail);
  const prefixLength = explicitLength ?? IPV4_MAX_PREFIX;
  if (prefixLength > IPV4_MAX_PREFIX) fail();
  const network = maskV4(ipv4, prefixLength);
  const rendered = formatIPv4(explicitLength === null ? ipv4 : network);
  return {
    version: 'ipv4',
    network,
    prefixLength,
    normalized:
      explicitLength === null ? rendered : `${rendered}/${prefixLength}`,
  };
}

function parseIPv4(address: string, fail: () => never): number {
  const parts = address.split('.');
  if (parts.length !== 4) fail();

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) fail();
    const octet = Number(part);
    if (octet > 255) fail();
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

function parseIPv6(address: string, fail: () => never): Hextets {
  if (address.includes('%') || address.split('::').length > 2) fail();

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

function expandEmbeddedV4(
  parts: string[],
  allowAtEnd: boolean,
  fail: () => never
): string[] {
  const dottedIndex = parts.findIndex((part) => part.includes('.'));
  if (dottedIndex === -1) return parts;
  if (!allowAtEnd || dottedIndex !== parts.length - 1) fail();

  const ipv4 = parseIPv4(parts[dottedIndex], fail);
  const high = ((ipv4 >>> 16) & 0xffff).toString(16);
  const low = (ipv4 & 0xffff).toString(16);
  return [...parts.slice(0, -1), high, low];
}

function parseHextet(part: string, fail: () => never): number {
  if (!/^[0-9a-fA-F]{1,4}$/.test(part)) fail();
  return parseInt(part, 16);
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

function formatIPv6(value: Hextets): string {
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
