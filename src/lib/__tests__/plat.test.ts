import { ipRangesFixture } from '@/__fixtures__/ip-ranges';
import { buildPrefixIndex, lookupPrefixes } from '@/lib/lookup';
import {
  buildFootprint,
  buildPlat,
  describeRange,
  describeSize,
  parentLengths,
} from '@/lib/plat';
import { CombinedPrefix } from '@/types';

const rows: CombinedPrefix[] = [
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
    prefix: '3.5.0.0/24',
    region: 'eu-west-1',
    service: 'AMAZON',
    network_border_group: 'eu-west-1',
    type: 'ipv4',
  },
  {
    prefix: '3.128.0.0/9',
    region: 'us-east-2',
    service: 'AMAZON',
    network_border_group: 'us-east-2',
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
    prefix: '2600:1f14:4000::/36',
    region: 'us-west-2',
    service: 'EC2',
    network_border_group: 'us-west-2',
    type: 'ipv6',
  },
];
const index = buildPrefixIndex(rows);

describe('parentLengths', () => {
  it('uses the two nearest octet or hextet boundaries above the lot', () => {
    expect(parentLengths('ipv4', 22)).toEqual([8, 16]);
    expect(parentLengths('ipv4', 24)).toEqual([8, 16]);
    expect(parentLengths('ipv4', 12)).toEqual([0, 8]);
    expect(parentLengths('ipv4', 8)).toEqual([0]);
    expect(parentLengths('ipv6', 35)).toEqual([16, 32]);
    expect(parentLengths('ipv6', 56)).toEqual([32, 48]);
  });
});

describe('buildPlat', () => {
  it('draws block /8, block /16 and the lot to scale for an IPv4 match', () => {
    const plat = buildPlat(index, lookupPrefixes(index, '3.5.140.2'));

    expect(plat.mode).toBe('match');
    expect(plat.bands.map((b) => [b.kind, b.cidr])).toEqual([
      ['block', '3.0.0.0/8'],
      ['block', '3.5.0.0/16'],
      ['lot', '3.5.140.0/22'],
    ]);

    const [slash8, slash16, lot] = plat.bands;
    // 3.5.0.0/16 is the 6th /16 of 256 in 3.0.0.0/8.
    expect(slash8.focus).toEqual({ start: 5 / 256, width: 1 / 256 });
    // 3.5.140.0/22 starts at 140/256 of 3.5.0.0/16 and is 4/256 wide.
    expect(slash16.focus).toEqual({ start: 140 / 256, width: 4 / 256 });
    expect(slash16.lot).toEqual({ start: 140 / 256, width: 4 / 256 });
    // The queried address is the 3rd of 1,024.
    expect(plat.point).toEqual({
      start: 2 / 1024,
      width: 1 / 1024,
      label: '3.5.140.2',
    });
    expect(lot.size).toBe('1,024 addresses');
    expect(lot.ticks.map((t) => t.label)).toEqual([
      '3.5.141.0',
      '3.5.142.0',
      '3.5.143.0',
    ]);
    expect(plat.lot?.records.map((r) => r.service)).toEqual(['S3', 'AMAZON']);
  });

  it('draws the other published prefixes inside each block', () => {
    const plat = buildPlat(index, lookupPrefixes(index, '3.5.140.2'));
    const lots = plat.bands[0].lots.map((l) => l.prefix);

    expect(lots).toEqual(['3.5.0.0/24', '3.5.140.0/22', '3.128.0.0/9']);
    expect(plat.bands[0].lots[2]).toMatchObject({ start: 0.5, width: 0.5 });
  });

  it('uses hextet boundaries for IPv6', () => {
    const plat = buildPlat(index, lookupPrefixes(index, '2600:1f14:4000::1'));

    expect(plat.bands.map((b) => b.cidr)).toEqual([
      '2600::/16',
      '2600:1f14::/32',
      '2600:1f14:4000::/36',
    ]);
    expect(plat.bands[1].focus).toEqual({ start: 0.25, width: 1 / 16 });
    expect(plat.bands[2].size).toBe('2⁹² addresses');
    expect(plat.point?.label).toBe('2600:1f14:4000::1');
    expect(plat.point?.start).toBeCloseTo(0, 12);
  });

  it('shows the surrounding blocks and the point when nothing matches', () => {
    const plat = buildPlat(index, lookupPrefixes(index, '3.4.0.9'));

    expect(plat.mode).toBe('none');
    expect(plat.lot).toBeUndefined();
    expect(plat.bands.map((b) => b.cidr)).toEqual(['3.0.0.0/8', '3.4.0.0/16']);
    expect(plat.point?.start).toBe(9 / 65536);
  });

  it('draws the queried range when published prefixes only fall inside it', () => {
    const fixture = buildPrefixIndex(
      [...ipRangesFixture.prefixes].map((p) => ({
        ...p,
        prefix: p.ip_prefix,
        type: 'ipv4' as const,
      }))
    );
    const plat = buildPlat(fixture, lookupPrefixes(fixture, '3.0.0.0/8'));

    expect(plat.mode).toBe('range');
    expect(plat.bands[plat.bands.length - 1]).toMatchObject({
      kind: 'range',
      cidr: '3.0.0.0/8',
    });
    expect(plat.point).toBeUndefined();
  });
});

describe('helpers', () => {
  it('describes sizes and ranges', () => {
    expect(describeSize('ipv4', 8)).toBe('16,777,216 addresses');
    expect(describeSize('ipv4', 32)).toBe('1 address');
    expect(describeSize('ipv6', 48)).toBe('2⁸⁰ addresses');
    expect(describeRange('3.5.140.0/22')).toEqual(['3.5.140.0', '3.5.143.255']);
    expect(describeRange('2600:1f14::/35')).toEqual([
      '2600:1f14::',
      '2600:1f14:1fff:ffff:ffff:ffff:ffff:ffff',
    ]);
  });

  it('builds a region footprint over the IPv4 space', () => {
    const plat = buildFootprint(rows);
    expect(plat?.bands).toHaveLength(1);
    expect(plat?.bands[0].lots.map((l) => l.prefix)).toEqual([
      '3.5.140.0/22',
      '3.5.0.0/24',
      '3.128.0.0/9',
    ]);
    expect(buildFootprint(rows.filter((r) => r.type === 'ipv6'))).toBeNull();
  });
});
