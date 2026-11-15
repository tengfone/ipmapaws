import Papa from 'papaparse';
import {
  InvalidLookupQueryError,
  lookupPrefixes,
  PrefixIndex,
  PrefixLookupResult,
} from '@/lib/lookup';
import { CombinedPrefix } from '@/types';

/**
 * Bulk lookup: many addresses pasted at once, typically straight out of a
 * log. Lines are split on whitespace, commas, semicolons and pipes; tokens
 * that look like an address are looked up, the rest of a log line is ignored.
 */

export const BULK_LIMIT = 1000;
const ECHO_LENGTH = 64;

export interface BulkToken {
  /** What the user pasted for this entry (punctuation trimmed). */
  input: string;
  /** What is looked up (port and brackets removed), or null when it is not an address at all. */
  query: string | null;
  /** 1-based line number in the pasted text. */
  line: number;
}

export interface ParsedBulkInput {
  tokens: BulkToken[];
  /** Entries found before the cap was applied. */
  total: number;
  truncated: boolean;
  /** Non-blank lines with no address in them (log noise), skipped. */
  skippedLines: number;
}

const V4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3})(\/\d{1,3})?(?::\d{1,5})?$/;
const BRACKETED = /^\[([^\]]+)\](\/\d{1,3})?(?::\d{1,5})?$/;
const V6_SHAPE = /^[0-9a-fA-F:.]+(?:%[\w.-]+)?(?:\/\d{1,3})?$/;
const LOOSE_V4 = /^\d+(?:\.\d+){2,}(?:\/\d+)?$/;

function trimPunctuation(token: string): string {
  return token.replace(/^["'(<{]+/, '').replace(/["')>},;.]+$/, '');
}

/**
 * The address a token stands for, or null when the token is not an attempt
 * at one. "1.2.3.4:443" gives "1.2.3.4", "[2600::1]:443" gives "2600::1".
 * Malformed attempts ("999.1.2.3", "10.0.0") are returned as-is so the
 * lookup can report them as invalid.
 */
export function candidateAddress(rawToken: string): string | null {
  const token = trimPunctuation(rawToken.trim());
  if (!token) return null;

  const v4 = V4_WITH_PORT.exec(token);
  if (v4) return `${v4[1]}${v4[2] ?? ''}`;

  const bracketed = BRACKETED.exec(token);
  if (bracketed && bracketed[1].includes(':')) {
    return `${bracketed[1]}${bracketed[2] ?? ''}`;
  }

  if (V6_SHAPE.test(token)) {
    const colons = (token.split('/')[0].match(/:/g) ?? []).length;
    // A full IPv6 address has seven colons or a "::"; clock times do not.
    if (token.includes('::') || colons === 7) return token;
  }

  if (LOOSE_V4.test(token)) return token;
  return null;
}

/** Splits pasted text into lookup entries, capped at `limit`. */
export function parseBulkInput(
  text: string,
  limit = BULK_LIMIT
): ParsedBulkInput {
  const tokens: BulkToken[] = [];
  let total = 0;
  let skippedLines = 0;

  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = line.split(/[\s,;|]+/).filter(Boolean);
    let found = 0;
    for (const part of parts) {
      const query = candidateAddress(part);
      if (query === null) continue;
      found += 1;
      total += 1;
      if (tokens.length < limit) {
        tokens.push({ input: trimPunctuation(part), query, line: i + 1 });
      }
    }
    if (found > 0) return;
    if (parts.length === 1) {
      // A lone word on its own line was meant as an address: report it.
      total += 1;
      if (tokens.length < limit) {
        const input =
          parts[0].length > ECHO_LENGTH
            ? `${parts[0].slice(0, ECHO_LENGTH)}…`
            : parts[0];
        tokens.push({ input, query: null, line: i + 1 });
      }
    } else {
      skippedLines += 1;
    }
  });

  return { tokens, total, truncated: total > tokens.length, skippedLines };
}

export type BulkStatus = 'aws' | 'not-aws' | 'invalid';

export interface BulkRow {
  input: string;
  line: number;
  status: BulkStatus;
  /** Normalised query, when the input parsed. */
  query?: string;
  result?: PrefixLookupResult;
  /** The most specific containing prefix and all its records. */
  lot?: {
    prefix: string;
    records: CombinedPrefix[];
    services: string[];
    regions: string[];
    groups: string[];
  };
  /** For a CIDR that no prefix contains: distinct AWS prefixes inside it. */
  inside?: number;
  error?: string;
}

/** The parser's reason without the echoed input: "IPv4 octet "999" is greater than 255". */
function invalidReason(message: string): string {
  const match = /^Invalid IP or CIDR ".*?": (.+?)\.?$/.exec(message);
  return match ? match[1] : 'Not an IP address or CIDR';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/** Looks up every token against the index, one row per token. */
export function runBulkLookup(
  index: PrefixIndex,
  tokens: readonly BulkToken[]
): BulkRow[] {
  return tokens.map((token) => {
    if (token.query === null) {
      return {
        input: token.input,
        line: token.line,
        status: 'invalid',
        error: 'Not an IP address or CIDR',
      };
    }
    let result: PrefixLookupResult;
    try {
      result = lookupPrefixes(index, token.query);
    } catch (error) {
      return {
        input: token.input,
        line: token.line,
        status: 'invalid',
        error:
          error instanceof InvalidLookupQueryError
            ? invalidReason(error.message)
            : 'Lookup failed',
      };
    }
    const best = result.bestMatch;
    if (!best) {
      return {
        input: token.input,
        line: token.line,
        status: 'not-aws',
        query: result.query,
        result,
        ...(result.containedTotal > 0
          ? { inside: new Set(result.contained.map((p) => p.prefix)).size }
          : {}),
      };
    }
    const records = result.containing.filter((p) => p.prefix === best.prefix);
    return {
      input: token.input,
      line: token.line,
      status: 'aws',
      query: result.query,
      result,
      lot: {
        prefix: best.prefix,
        records,
        services: unique(records.map((r) => r.service)),
        regions: unique(records.map((r) => r.region)),
        groups: unique(records.map((r) => r.network_border_group)),
      },
    };
  });
}

export function summarizeBulk(rows: readonly BulkRow[]) {
  let aws = 0;
  let notAws = 0;
  let invalid = 0;
  for (const row of rows) {
    if (row.status === 'aws') aws += 1;
    else if (row.status === 'not-aws') notAws += 1;
    else invalid += 1;
  }
  return { total: rows.length, aws, notAws, invalid };
}

/** Records of every matched lot, for allow-list formats. */
export function bulkRecords(rows: readonly BulkRow[]): CombinedPrefix[] {
  return rows.flatMap((row) => row.lot?.records ?? []);
}

/** One CSV row per input. */
export function bulkToCsv(rows: readonly BulkRow[]): string {
  return Papa.unparse(
    rows.map((row) => ({
      input: row.input,
      status:
        row.status === 'aws'
          ? 'AWS'
          : row.status === 'not-aws'
            ? 'Not AWS'
            : 'Invalid',
      prefix: row.lot?.prefix ?? '',
      services: row.lot?.services.join(' ') ?? '',
      region: row.lot?.regions.join(' ') ?? '',
      network_border_group: row.lot?.groups.join(' ') ?? '',
      note:
        row.error ?? (row.inside ? `${row.inside} AWS prefixes inside` : ''),
    })),
    {
      header: true,
      columns: [
        'input',
        'status',
        'prefix',
        'services',
        'region',
        'network_border_group',
        'note',
      ],
    }
  );
}
