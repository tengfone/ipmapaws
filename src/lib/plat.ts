import {
  formatNetwork,
  lookupPrefixes,
  parseAddress,
  ParsedAddress,
  PrefixIndex,
  PrefixLookupResult,
} from '@/lib/lookup';
import { CombinedPrefix } from '@/types';

/**
 * The parcel strip ("plat"): a lookup drawn to scale.
 *
 * Each band is one address range drawn edge to edge. The band below it is an
 * enlargement of one window of the band above, so a /8 block, the /16 block
 * inside it and the matched AWS prefix (the lot) can all be read at once. All
 * positions are fractions of the band they sit in, computed from the real
 * network numbers; the renderer only multiplies by the drawing width.
 *
 * Address arithmetic works on 16-bit groups (2 for IPv4, 8 for IPv6) and never
 * reads more than 52 bits at a time, so plain doubles stay exact.
 */

export type BandKind = 'space' | 'block' | 'lot' | 'range';

export interface PlatSpan {
  /** Left edge as a fraction of the band, 0..1. */
  start: number;
  /** Width as a fraction of the band, 0..1 (may be far below one pixel). */
  width: number;
}

export interface PlatLot extends PlatSpan {
  prefix: string;
}

export interface PlatTick {
  at: number;
  label: string;
}

export interface PlatBand {
  kind: BandKind;
  /** The band's range in CIDR form, e.g. "3.5.0.0/16". */
  cidr: string;
  prefixLength: number;
  /** "16,777,216 addresses" or "2⁸⁰ addresses". */
  size: string;
  /** Quarter points of the band, labelled with their first address. */
  ticks: PlatTick[];
  /** Published AWS prefixes strictly inside this band, deduplicated, in address order. */
  lots: PlatLot[];
  /** Where the matched lot sits inside this band (blocks only). */
  lot?: PlatSpan;
  /** The window that the next band enlarges. */
  focus?: PlatSpan;
}

export interface PlatModel {
  version: 'ipv4' | 'ipv6';
  /** match: a published prefix contains the query; range: published prefixes only fall inside it; none: no AWS address. */
  mode: 'match' | 'range' | 'none';
  /** The query as the lookup normalised it. */
  query: string;
  bands: PlatBand[];
  /** The queried address (or CIDR) inside the last band. */
  point?: PlatSpan & { label: string };
  /** The matched lot and every service/region record AWS publishes for it. */
  lot?: {
    prefix: string;
    records: CombinedPrefix[];
  };
}

interface Net {
  version: 'ipv4' | 'ipv6';
  bits: number;
  groups: number[];
  length: number;
}

const MAX_SAFE_BITS = 52;
const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

/* ------------------------------------------------------------------------ */
/* Address arithmetic                                                       */
/* ------------------------------------------------------------------------ */

function toNet(address: ParsedAddress): Net {
  if (address.version === 'ipv4') {
    return {
      version: 'ipv4',
      bits: 32,
      groups: [
        Math.floor(address.network / 65536) & 0xffff,
        address.network & 0xffff,
      ],
      length: address.prefixLength,
    };
  }
  return {
    version: 'ipv6',
    bits: 128,
    groups: [...address.network],
    length: address.prefixLength,
  };
}

function toParsed(net: Net): ParsedAddress {
  if (net.version === 'ipv4') {
    return {
      version: 'ipv4',
      network: (net.groups[0] * 65536 + net.groups[1]) >>> 0,
      prefixLength: net.length,
    };
  }
  const g = net.groups;
  return {
    version: 'ipv6',
    network: [g[0], g[1], g[2], g[3], g[4], g[5], g[6], g[7]],
    prefixLength: net.length,
  };
}

function bitAt(groups: number[], index: number): number {
  return (groups[index >> 4] >> (15 - (index & 15))) & 1;
}

/** Reads `count` bits (at most 52) starting at bit `start`, as an integer. */
function readBits(groups: number[], start: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count; i += 1) {
    value = value * 2 + bitAt(groups, start + i);
  }
  return value;
}

/** Copy of `groups` with `count` bits starting at `start` replaced by `value`. */
function writeBits(
  groups: number[],
  start: number,
  count: number,
  value: number
): number[] {
  const out = [...groups];
  for (let i = count - 1, v = value; i >= 0; i -= 1, v = Math.floor(v / 2)) {
    const index = start + i;
    const group = index >> 4;
    const shift = 15 - (index & 15);
    out[group] =
      (v % 2 ? out[group] | (1 << shift) : out[group] & ~(1 << shift)) & 0xffff;
  }
  return out;
}

function maskNet(net: Net, length: number): Net {
  const host = net.bits - length;
  return {
    ...net,
    groups: host > 0 ? writeBits(net.groups, length, host, 0) : [...net.groups],
    length,
  };
}

function cidrOf(net: Net): string {
  return `${formatNetwork(toParsed(net))}/${net.length}`;
}

function addressOf(net: Net, groups: number[]): string {
  return formatNetwork(toParsed({ ...net, groups }));
}

/** Offset of `groups` inside `parent`, as a fraction of the parent's size. */
function fractionIn(parent: Net, groups: number[]): number {
  const host = parent.bits - parent.length;
  if (host <= 0) return 0;
  const count = Math.min(MAX_SAFE_BITS, host);
  return readBits(groups, parent.length, count) / 2 ** count;
}

function spanIn(parent: Net, child: Net): PlatSpan {
  return {
    start: fractionIn(parent, child.groups),
    width: 2 ** (parent.length - Math.max(parent.length, child.length)),
  };
}

function superscript(value: number): string {
  return String(value)
    .split('')
    .map((digit) => SUPERSCRIPT[Number(digit)])
    .join('');
}

/** Number of addresses in a prefix, written out for IPv4 and as a power of two for IPv6. */
export function describeSize(
  version: 'ipv4' | 'ipv6',
  prefixLength: number
): string {
  const host = (version === 'ipv4' ? 32 : 128) - prefixLength;
  if (version === 'ipv4' || host <= 20) {
    const count = 2 ** host;
    return `${count.toLocaleString('en-US')} ${count === 1 ? 'address' : 'addresses'}`;
  }
  return `2${superscript(host)} addresses`;
}

/** First and last address of a prefix, e.g. ["3.5.140.0", "3.5.143.255"]. */
export function describeRange(prefix: string): [string, string] | null {
  try {
    const net = toNet(parseAddress(prefix));
    const first = maskNet(net, net.length).groups;
    const last = [...first];
    for (let i = net.length; i < net.bits; i += 1) {
      last[i >> 4] |= 1 << (15 - (i & 15));
    }
    return [addressOf(net, first), addressOf(net, last)];
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------ */
/* Bands                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * The parent blocks drawn above a lot: the two nearest octet boundaries (IPv4)
 * or hextet boundaries (IPv6) that are strictly shorter than the lot, so a
 * /22 gets /8 and /16, a /35 gets /16 and /32, and a /12 gets /0 and /8.
 */
export function parentLengths(
  version: 'ipv4' | 'ipv6',
  length: number,
  count = 2
): number[] {
  const step = version === 'ipv4' ? 8 : 16;
  const lengths: number[] = [];
  for (
    let l = Math.ceil(length / step) * step - step;
    l >= 0 && lengths.length < count;
    l -= step
  ) {
    if (l < length) lengths.unshift(l);
  }
  return lengths;
}

function ticksFor(net: Net): PlatTick[] {
  if (net.bits - net.length < 2) return [];
  return [1, 2, 3].map((k) => ({
    at: k / 4,
    label: addressOf(net, writeBits(net.groups, net.length, 2, k)),
  }));
}

function lotsIn(index: PrefixIndex, band: Net): PlatLot[] {
  const result = lookupPrefixes(index, cidrOf(band), {
    containedLimit: Number.MAX_SAFE_INTEGER,
  });
  const seen = new Set<string>();
  const lots: PlatLot[] = [];
  for (const entry of result.contained) {
    if (seen.has(entry.prefix)) continue;
    seen.add(entry.prefix);
    try {
      lots.push({
        prefix: entry.prefix,
        ...spanIn(band, toNet(parseAddress(entry.prefix))),
      });
    } catch {
      // Unparseable rows are already skipped by the index.
    }
  }
  return lots;
}

function makeBand(kind: BandKind, net: Net, index: PrefixIndex): PlatBand {
  const lots = lotsIn(index, net);
  return {
    kind,
    cidr: cidrOf(net),
    prefixLength: net.length,
    size: describeSize(net.version, net.length),
    ticks: ticksFor(net),
    lots,
  };
}

/** Chains bands so each one marks the window the next one enlarges. */
function chain(bands: PlatBand[], nets: Net[], lot: Net | null): PlatBand[] {
  return bands.map((band, i) => {
    const next = nets[i + 1];
    return {
      ...band,
      ...(next ? { focus: spanIn(nets[i], next) } : {}),
      ...(lot && band.kind !== 'lot' ? { lot: spanIn(nets[i], lot) } : {}),
    };
  });
}

/**
 * Builds the plat for a finished lookup.
 *
 * - match: parent blocks of the best match, then the best match as the lot,
 *   with the query marked inside it.
 * - range: a CIDR that no published prefix contains but that holds published
 *   prefixes; parent blocks, then the queried range with those prefixes.
 * - none: the /8 and /16 (IPv4) or /16 and /32 (IPv6) around the query, with
 *   whatever AWS publishes nearby, and the query marked in the last one.
 */
export function buildPlat(
  index: PrefixIndex,
  result: PrefixLookupResult
): PlatModel {
  const query = toNet(parseAddress(result.mappedIPv4 ?? result.query));
  const version = query.version;

  if (result.bestMatch) {
    const lotNet = toNet(parseAddress(result.bestMatch.prefix));
    const nets = [
      ...parentLengths(version, lotNet.length).map((l) => maskNet(lotNet, l)),
      lotNet,
    ];
    const bands = nets.map((net, i) =>
      makeBand(
        i === nets.length - 1 ? 'lot' : net.length === 0 ? 'space' : 'block',
        net,
        index
      )
    );
    return {
      version,
      mode: 'match',
      query: result.query,
      bands: chain(bands, nets, lotNet),
      point: { ...spanIn(lotNet, query), label: result.query },
      lot: {
        prefix: result.bestMatch.prefix,
        records: result.containing.filter(
          (p) => p.prefix === result.bestMatch!.prefix
        ),
      },
    };
  }

  if (result.found) {
    const nets = [
      ...parentLengths(version, query.length).map((l) => maskNet(query, l)),
      query,
    ];
    const bands = nets.map((net, i) =>
      makeBand(
        i === nets.length - 1 ? 'range' : net.length === 0 ? 'space' : 'block',
        net,
        index
      )
    );
    return {
      version,
      mode: 'range',
      query: result.query,
      bands: chain(bands, nets, null),
    };
  }

  const blockLengths = (version === 'ipv4' ? [8, 16] : [16, 32]).filter(
    (l) => l < query.length
  );
  const lengths = blockLengths.length > 0 ? blockLengths : [0];
  const nets = lengths.map((l) => maskNet(query, l));
  const bands = nets.map((net) =>
    makeBand(net.length === 0 ? 'space' : 'block', net, index)
  );
  const last = nets[nets.length - 1];
  return {
    version,
    mode: 'none',
    query: result.query,
    bands: chain(bands, nets, null),
    point: { ...spanIn(last, query), label: result.query },
  };
}

/**
 * One band of the whole IPv4 space with the given prefixes drawn on it, for
 * a region or region/service footprint.
 */
export function buildFootprint(
  prefixes: readonly CombinedPrefix[]
): PlatModel | null {
  const space: Net = { version: 'ipv4', bits: 32, groups: [0, 0], length: 0 };
  const seen = new Set<string>();
  const lots: PlatLot[] = [];
  for (const p of prefixes) {
    if (p.type !== 'ipv4' || seen.has(p.prefix)) continue;
    seen.add(p.prefix);
    try {
      lots.push({
        prefix: p.prefix,
        ...spanIn(space, toNet(parseAddress(p.prefix))),
      });
    } catch {
      // Skip rows that are not valid prefixes.
    }
  }
  if (lots.length === 0) return null;
  return {
    version: 'ipv4',
    mode: 'range',
    query: '0.0.0.0/0',
    bands: [
      {
        kind: 'space',
        cidr: '0.0.0.0/0',
        prefixLength: 0,
        size: describeSize('ipv4', 0),
        ticks: ticksFor(space),
        lots,
      },
    ],
  };
}
