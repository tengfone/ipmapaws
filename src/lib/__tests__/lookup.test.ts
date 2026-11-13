import { CombinedPrefix } from '@/types';
import { InvalidLookupQueryError, lookupContainingPrefixes } from '../lookup';

function prefix(
  cidr: string,
  type: 'ipv4' | 'ipv6',
  overrides: Partial<CombinedPrefix> = {}
): CombinedPrefix {
  return {
    prefix: cidr,
    region: 'us-east-1',
    service: 'EC2',
    network_border_group: 'us-east-1',
    type,
    ...overrides,
  };
}

const dataset: CombinedPrefix[] = [
  prefix('192.0.2.0/24', 'ipv4', {
    service: 'EC2',
    region: 'us-east-1',
    network_border_group: 'us-east-1',
  }),
  prefix('192.0.2.0/25', 'ipv4', {
    service: 'S3',
    region: 'us-east-1',
    network_border_group: 'us-east-1',
  }),
  prefix('192.0.2.128/25', 'ipv4', {
    service: 'S3',
    region: 'us-west-2',
    network_border_group: 'us-west-2',
  }),
  prefix('198.51.100.0/24', 'ipv4', {
    service: 'EC2',
    region: 'eu-west-1',
    network_border_group: 'eu-west-1',
  }),
  prefix('0.0.0.0/0', 'ipv4', {
    service: 'AMAZON',
    region: 'GLOBAL',
    network_border_group: 'GLOBAL',
  }),
  prefix('2001:db8::/32', 'ipv6', {
    service: 'EC2',
    region: 'us-east-1',
    network_border_group: 'us-east-1',
  }),
  prefix('2001:db8:1::/48', 'ipv6', {
    service: 'CLOUDFRONT',
    region: 'eu-west-1',
    network_border_group: 'eu-west-1',
  }),
  prefix('2001:db8:1:2::/64', 'ipv6', {
    service: 'S3',
    region: 'eu-west-1',
    network_border_group: 'eu-west-1',
  }),
];

describe('lookupContainingPrefixes', () => {
  it('returns every IPv4 prefix that contains a single address', () => {
    const result = lookupContainingPrefixes(dataset, '192.0.2.10');

    expect(result.found).toBe(true);
    expect(result.query).toBe('192.0.2.10');
    expect(result.matches.map((match) => match.prefix)).toEqual([
      '192.0.2.0/24',
      '192.0.2.0/25',
      '0.0.0.0/0',
    ]);
    expect(result.matches[0]).toEqual({
      prefix: '192.0.2.0/24',
      region: 'us-east-1',
      service: 'EC2',
      network_border_group: 'us-east-1',
      type: 'ipv4',
    });
  });

  it('returns an empty result when no published prefix contains the address', () => {
    const withoutDefault = dataset.filter(
      (entry) => entry.prefix !== '0.0.0.0/0'
    );
    const result = lookupContainingPrefixes(withoutDefault, '203.0.113.5');

    expect(result.found).toBe(false);
    expect(result.query).toBe('203.0.113.5');
    expect(result.matches).toEqual([]);
  });

  it('matches an IPv4 CIDR only when it is fully inside the prefix', () => {
    const withoutDefault = dataset.filter(
      (entry) => entry.prefix !== '0.0.0.0/0'
    );
    const inside = lookupContainingPrefixes(withoutDefault, '192.0.2.200/28');
    const exact = lookupContainingPrefixes(withoutDefault, '192.0.2.128/25');
    const larger = lookupContainingPrefixes(withoutDefault, '192.0.2.0/23');
    const overlap = lookupContainingPrefixes(withoutDefault, '192.0.2.0/24');

    expect(inside.matches.map((match) => match.prefix)).toEqual([
      '192.0.2.0/24',
      '192.0.2.128/25',
    ]);
    expect(exact.matches.map((match) => match.prefix)).toEqual([
      '192.0.2.0/24',
      '192.0.2.128/25',
    ]);
    expect(larger.matches).toEqual([]);
    expect(overlap.matches.map((match) => match.prefix)).toEqual([
      '192.0.2.0/24',
    ]);
  });

  it('normalizes host bits in an IPv4 CIDR to the network address', () => {
    const result = lookupContainingPrefixes(dataset, '192.0.2.10/24');

    expect(result.query).toBe('192.0.2.0/24');
    expect(result.matches.map((match) => match.prefix)).toEqual([
      '192.0.2.0/24',
      '0.0.0.0/0',
    ]);
  });

  it('accepts compressed and uppercase IPv6 and returns containing prefixes', () => {
    const result = lookupContainingPrefixes(dataset, '2001:DB8:1:2::A');

    expect(result.query).toBe('2001:db8:1:2::a');
    expect(result.found).toBe(true);
    expect(
      result.matches.map((match) => `${match.prefix} ${match.service}`)
    ).toEqual([
      '2001:db8::/32 EC2',
      '2001:db8:1::/48 CLOUDFRONT',
      '2001:db8:1:2::/64 S3',
    ]);
    expect(result.matches[2]).toMatchObject({
      prefix: '2001:db8:1:2::/64',
      region: 'eu-west-1',
      service: 'S3',
      network_border_group: 'eu-west-1',
      type: 'ipv6',
    });
  });

  it('matches an IPv6 CIDR only when it sits fully inside the prefix', () => {
    const inside = lookupContainingPrefixes(dataset, '2001:db8:1:2:3::/80');
    const tooWide = lookupContainingPrefixes(dataset, '2001:db8::/16');
    const otherBlock = lookupContainingPrefixes(dataset, '2001:db9::1');
    const onlyTheAggregate = lookupContainingPrefixes(dataset, '2001:db8:2::1');

    expect(inside.query).toBe('2001:db8:1:2:3::/80');
    expect(inside.matches.map((match) => match.prefix)).toEqual([
      '2001:db8::/32',
      '2001:db8:1::/48',
      '2001:db8:1:2::/64',
    ]);
    expect(tooWide.matches).toEqual([]);
    expect(otherBlock.matches).toEqual([]);
    expect(onlyTheAggregate.matches.map((match) => match.prefix)).toEqual([
      '2001:db8::/32',
    ]);
  });

  it('honors IPv6 prefix lengths that are not a multiple of 16', () => {
    const prefixes = [
      prefix('2001:db8:8000::/33', 'ipv6', { service: 'EC2' }),
      prefix('2001:db8::/32', 'ipv6', { service: 'AMAZON' }),
    ];

    const upper = lookupContainingPrefixes(prefixes, '2001:db8:8000::1');
    const lower = lookupContainingPrefixes(prefixes, '2001:db8:4000::1');
    const upperCidr = lookupContainingPrefixes(prefixes, '2001:db8:c000::/34');

    expect(upper.query).toBe('2001:db8:8000::1');
    expect(upper.matches.map((match) => match.prefix)).toEqual([
      '2001:db8:8000::/33',
      '2001:db8::/32',
    ]);
    expect(lower.matches.map((match) => match.prefix)).toEqual([
      '2001:db8::/32',
    ]);
    expect(upperCidr.query).toBe('2001:db8:c000::/34');
    expect(upperCidr.matches.map((match) => match.prefix)).toEqual([
      '2001:db8:8000::/33',
      '2001:db8::/32',
    ]);
  });

  it('expands a fully written IPv6 address to the same compressed query', () => {
    const result = lookupContainingPrefixes(
      dataset,
      '2001:0db8:0000:0000:0000:0000:0000:0001'
    );

    expect(result.query).toBe('2001:db8::1');
    expect(result.matches.map((match) => match.prefix)).toEqual([
      '2001:db8::/32',
    ]);
  });

  it('does not match an address against the other IP family', () => {
    const result = lookupContainingPrefixes(
      [prefix('2001:db8::/32', 'ipv6')],
      '192.0.2.1'
    );

    expect(result.found).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it('keeps dataset order and does not mutate the input', () => {
    const input = [
      prefix('10.0.0.0/8', 'ipv4', { service: 'AMAZON' }),
      prefix('10.1.2.0/24', 'ipv4', { service: 'EC2' }),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));

    const result = lookupContainingPrefixes(input, '10.1.2.9');

    expect(result.matches.map((match) => match.service)).toEqual([
      'AMAZON',
      'EC2',
    ]);
    expect(input).toEqual(snapshot);
  });

  it('treats a /0 prefix as containing every address of that family', () => {
    const ipv4 = lookupContainingPrefixes(
      [prefix('0.0.0.0/0', 'ipv4')],
      '8.8.8.8'
    );
    const ipv6 = lookupContainingPrefixes(
      [prefix('::/0', 'ipv6')],
      '2001:db8::1'
    );
    const notTheWorld = lookupContainingPrefixes(
      [prefix('192.0.2.0/24', 'ipv4')],
      '0.0.0.0/0'
    );

    expect(ipv4.matches).toHaveLength(1);
    expect(ipv6.matches).toHaveLength(1);
    expect(ipv6.query).toBe('2001:db8::1');
    expect(notTheWorld.found).toBe(false);
  });

  it('skips malformed dataset rows instead of failing the lookup', () => {
    const result = lookupContainingPrefixes(
      [prefix('not-a-prefix', 'ipv4'), prefix('192.0.2.0/24', 'ipv4')],
      '192.0.2.1'
    );

    expect(result.matches.map((match) => match.prefix)).toEqual([
      '192.0.2.0/24',
    ]);
  });

  it.each([
    '',
    '   ',
    'not-an-ip',
    '256.1.1.1',
    '192.0.2.1/33',
    '192.0.2.1/abc',
    '1.2.3',
    '2001:db8::/129',
    '2001:db8:::1',
    'gggg::1',
    '192.0.2.1/24/32',
  ])('rejects garbage query %j', (query) => {
    expect(() => lookupContainingPrefixes(dataset, query)).toThrow(
      InvalidLookupQueryError
    );
  });

  it('uses a message the API can return for a bad query', () => {
    expect(() => lookupContainingPrefixes(dataset, 'nope')).toThrow(
      /IPv4 address, IPv6 address, or CIDR/
    );
  });
});
