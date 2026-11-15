import Papa from 'papaparse';
import { parseAddress, ParsedAddress } from '@/lib/lookup';
import { CombinedPrefix } from '@/types';

/**
 * Allow-list formats for a set of AWS prefixes: what a firewall, security
 * group, proxy or Terraform module wants pasted in. Everything here is pure
 * string building on data the browser already has.
 */

export type AllowListFormat = 'cidr' | 'aws-sg' | 'nginx' | 'terraform' | 'csv';

export interface FormatInfo {
  id: AllowListFormat;
  /** Short name used in stamps: "Copied 312 CIDRs as nginx". */
  name: string;
  label: string;
  description: string;
  extension: string;
  mime: string;
}

export const ALLOW_LIST_FORMATS: FormatInfo[] = [
  {
    id: 'cidr',
    name: 'a CIDR list',
    label: 'Plain CIDR list',
    description: 'One prefix per line, IPv4 then IPv6',
    extension: 'txt',
    mime: 'text/plain',
  },
  {
    id: 'aws-sg',
    name: 'security-group JSON',
    label: 'Security group JSON',
    description:
      'IpPermissions for authorize-security-group-ingress; all protocols, edit ports first',
    extension: 'json',
    mime: 'application/json',
  },
  {
    id: 'nginx',
    name: 'nginx',
    label: 'nginx allow',
    description: 'allow lines, with a commented deny all',
    extension: 'conf',
    mime: 'text/plain',
  },
  {
    id: 'terraform',
    name: 'Terraform',
    label: 'Terraform locals',
    description: 'IPv4, IPv6 and combined lists in a locals block',
    extension: 'tf',
    mime: 'text/plain',
  },
  {
    id: 'csv',
    name: 'CSV',
    label: 'CSV',
    description: 'Every record with region, service and border group',
    extension: 'csv',
    mime: 'text/csv',
  },
];

/** One distinct prefix and what AWS lists it for. */
export interface CidrEntry {
  prefix: string;
  version: 'ipv4' | 'ipv6';
  services: string[];
  regions: string[];
}

interface Sortable {
  entry: CidrEntry;
  parsed: ParsedAddress;
}

function compareParsed(a: ParsedAddress, b: ParsedAddress): number {
  if (a.version !== b.version) return a.version === 'ipv4' ? -1 : 1;
  if (a.version === 'ipv4' && b.version === 'ipv4') {
    return a.network - b.network || a.prefixLength - b.prefixLength;
  }
  if (a.version === 'ipv6' && b.version === 'ipv6') {
    for (let i = 0; i < 8; i += 1) {
      const diff = a.network[i] - b.network[i];
      if (diff !== 0) return diff;
    }
  }
  return a.prefixLength - b.prefixLength;
}

/**
 * Distinct prefixes from a set of records, in address order (IPv4 first),
 * each with the services and regions AWS lists it under.
 */
export function collectCidrs(
  records: ReadonlyArray<Pick<CombinedPrefix, 'prefix' | 'service' | 'region'>>
): CidrEntry[] {
  const byPrefix = new Map<string, Sortable>();
  for (const record of records) {
    const existing = byPrefix.get(record.prefix);
    if (existing) {
      if (!existing.entry.services.includes(record.service)) {
        existing.entry.services.push(record.service);
      }
      if (!existing.entry.regions.includes(record.region)) {
        existing.entry.regions.push(record.region);
      }
      continue;
    }
    let parsed: ParsedAddress;
    try {
      parsed = parseAddress(record.prefix);
    } catch {
      continue;
    }
    byPrefix.set(record.prefix, {
      parsed,
      entry: {
        prefix: record.prefix,
        version: parsed.version,
        services: [record.service],
        regions: [record.region],
      },
    });
  }
  return Array.from(byPrefix.values())
    .sort((a, b) => compareParsed(a.parsed, b.parsed))
    .map((item) => item.entry);
}

export interface FormatOptions {
  /** AWS createDate of the data, written into comments. */
  createDate?: string;
  /** What the set is, e.g. "S3 in us-east-1", written into comments. */
  scope?: string;
}

function header(entries: CidrEntry[], options: FormatOptions): string[] {
  const v4 = entries.filter((e) => e.version === 'ipv4').length;
  const v6 = entries.length - v4;
  return [
    `AWS IP ranges${options.scope ? ` for ${options.scope}` : ''}, from ip-ranges.json${
      options.createDate ? ` (${options.createDate})` : ''
    } via IPMapAWS`,
    `${v4} IPv4 and ${v6} IPv6 CIDRs`,
  ];
}

/** Security group rule descriptions allow only a limited character set. */
function sgDescription(entry: CidrEntry): string {
  const text = `AWS ${entry.services.join('+')} ${entry.regions.join(',')}`;
  return text
    .replace(/[^a-zA-Z0-9. _\-:/()#,@[\]+=&;{}!$*]/g, '')
    .slice(0, 255);
}

function hclList(values: string[]): string {
  if (values.length === 0) return '[]';
  return `[\n${values.map((v) => `    "${v}",`).join('\n')}\n  ]`;
}

/** Formats CIDR entries (already deduplicated and sorted) as an allow-list. */
export function formatCidrs(
  format: Exclude<AllowListFormat, 'csv'>,
  entries: CidrEntry[],
  options: FormatOptions = {}
): string {
  const v4 = entries.filter((e) => e.version === 'ipv4');
  const v6 = entries.filter((e) => e.version === 'ipv6');

  switch (format) {
    case 'cidr':
      return (
        entries.map((e) => e.prefix).join('\n') + (entries.length ? '\n' : '')
      );

    case 'aws-sg': {
      const permission: Record<string, unknown> = { IpProtocol: '-1' };
      if (v4.length) {
        permission.IpRanges = v4.map((e) => ({
          CidrIp: e.prefix,
          Description: sgDescription(e),
        }));
      }
      if (v6.length) {
        permission.Ipv6Ranges = v6.map((e) => ({
          CidrIpv6: e.prefix,
          Description: sgDescription(e),
        }));
      }
      return `${JSON.stringify([permission], null, 2)}\n`;
    }

    case 'nginx':
      return [
        ...header(entries, options).map((line) => `# ${line}`),
        ...entries.map((e) => `allow ${e.prefix};`),
        '# deny all;  # uncomment to refuse every address not listed above',
        '',
      ].join('\n');

    case 'terraform':
      return [
        ...header(entries, options).map((line) => `# ${line}`),
        'locals {',
        `  aws_cidrs_ipv4 = ${hclList(v4.map((e) => e.prefix))}`,
        `  aws_cidrs_ipv6 = ${hclList(v6.map((e) => e.prefix))}`,
        '  aws_cidrs      = concat(local.aws_cidrs_ipv4, local.aws_cidrs_ipv6)',
        '}',
        '',
      ].join('\n');
  }
}

/** CSV of records, one row each, in the register's column order. */
export function recordsToCsv(records: readonly CombinedPrefix[]): string {
  return Papa.unparse(records as CombinedPrefix[], {
    header: true,
    columns: ['prefix', 'region', 'service', 'network_border_group', 'type'],
  });
}
