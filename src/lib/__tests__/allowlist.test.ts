import { collectCidrs, formatCidrs, recordsToCsv } from '@/lib/allowlist';
import { CombinedPrefix } from '@/types';

const records: CombinedPrefix[] = [
  {
    prefix: '52.94.76.0/22',
    region: 'us-west-2',
    service: 'AMAZON',
    network_border_group: 'us-west-2',
    type: 'ipv4',
  },
  {
    prefix: '2600:1f14::/35',
    region: 'us-west-2',
    service: 'EC2',
    network_border_group: 'us-west-2',
    type: 'ipv6',
  },
  {
    prefix: '3.5.140.0/22',
    region: 'ap-northeast-2',
    service: 'S3',
    network_border_group: 'ap-northeast-2',
    type: 'ipv4',
  },
  {
    prefix: '3.5.140.0/22',
    region: 'ap-northeast-2',
    service: 'AMAZON',
    network_border_group: 'ap-northeast-2',
    type: 'ipv4',
  },
  {
    prefix: '3.5.0.0/16',
    region: 'eu-west-1',
    service: 'AMAZON',
    network_border_group: 'eu-west-1',
    type: 'ipv4',
  },
  {
    prefix: '2600:1f00::/24',
    region: 'us-east-1',
    service: 'AMAZON',
    network_border_group: 'us-east-1',
    type: 'ipv6',
  },
];

describe('collectCidrs', () => {
  it('dedupes prefixes and sorts them numerically, IPv4 before IPv6', () => {
    const entries = collectCidrs(records);
    expect(entries.map((e) => e.prefix)).toEqual([
      '3.5.0.0/16',
      '3.5.140.0/22',
      '52.94.76.0/22',
      '2600:1f00::/24',
      '2600:1f14::/35',
    ]);
    expect(entries[1].services).toEqual(['S3', 'AMAZON']);
  });
});

describe('formatCidrs', () => {
  const entries = collectCidrs(records);
  const options = { createDate: '2026-11-14-17-37-05', scope: 'a test' };

  it('writes a plain list, one CIDR per line', () => {
    expect(formatCidrs('cidr', entries)).toBe(
      '3.5.0.0/16\n3.5.140.0/22\n52.94.76.0/22\n2600:1f00::/24\n2600:1f14::/35\n'
    );
  });

  it('writes security group ingress JSON that parses, split by family', () => {
    const parsed = JSON.parse(formatCidrs('aws-sg', entries, options));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].IpProtocol).toBe('-1');
    expect(parsed[0].IpRanges.map((r: { CidrIp: string }) => r.CidrIp)).toEqual(
      ['3.5.0.0/16', '3.5.140.0/22', '52.94.76.0/22']
    );
    expect(
      parsed[0].Ipv6Ranges.map((r: { CidrIpv6: string }) => r.CidrIpv6)
    ).toEqual(['2600:1f00::/24', '2600:1f14::/35']);
    expect(parsed[0].IpRanges[1].Description).toBe(
      'AWS S3+AMAZON ap-northeast-2'
    );
  });

  it('omits an empty address family from the JSON', () => {
    const v4Only = entries.filter((e) => e.version === 'ipv4');
    const parsed = JSON.parse(formatCidrs('aws-sg', v4Only));
    expect(parsed[0].Ipv6Ranges).toBeUndefined();
  });

  it('writes nginx allow lines with a commented deny', () => {
    const out = formatCidrs('nginx', entries, options);
    const lines = out.trim().split('\n');
    expect(lines.filter((l) => l.startsWith('allow '))).toHaveLength(5);
    expect(lines).toContain('allow 2600:1f14::/35;');
    expect(
      lines.every((l) => l.startsWith('#') || /^allow [0-9a-f.:/]+;$/.test(l))
    ).toBe(true);
    expect(out).toContain('# deny all;');
    expect(out).toContain('(2026-11-14-17-37-05)');
  });

  it('writes Terraform locals with IPv4, IPv6 and combined lists', () => {
    const out = formatCidrs('terraform', entries, options);
    expect(out).toContain('locals {');
    expect(out).toContain(
      '  aws_cidrs_ipv4 = [\n    "3.5.0.0/16",\n    "3.5.140.0/22",\n    "52.94.76.0/22",\n  ]'
    );
    expect(out).toContain('    "2600:1f14::/35",');
    expect(out).toContain(
      'aws_cidrs      = concat(local.aws_cidrs_ipv4, local.aws_cidrs_ipv6)'
    );
    expect(out.trim().endsWith('}')).toBe(true);
    expect(formatCidrs('terraform', [])).toContain('aws_cidrs_ipv4 = []');
  });
});

describe('recordsToCsv', () => {
  it('keeps every record in register column order', () => {
    const csv = recordsToCsv(records.slice(0, 1));
    expect(csv.split(/\r?\n/)).toEqual([
      'prefix,region,service,network_border_group,type',
      '52.94.76.0/22,us-west-2,AMAZON,us-west-2,ipv4',
    ]);
  });
});
