import { AWSIPRanges, CombinedPrefix } from '@/types';
import {
  buildPrefixIndex,
  getPrefixIndex,
  InvalidLookupQueryError,
  isValidCidr,
  lookupContainingPrefixes,
  lookupPrefixes,
  normalizeQuery,
} from '../lookup';

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

const cidrs = (list: CombinedPrefix[]) => list.map((entry) => entry.prefix);

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

const withoutDefault = dataset.filter((entry) => entry.prefix !== '0.0.0.0/0');

describe('lookupContainingPrefixes: containing prefixes', () => {
  it('returns every IPv4 prefix that contains an address, most specific first', () => {
    const result = lookupContainingPrefixes(dataset, '192.0.2.10');

    expect(result.found).toBe(true);
    expect(result.version).toBe('ipv4');
    expect(result.query).toBe('192.0.2.10');
    expect(cidrs(result.containing)).toEqual([
      '192.0.2.0/25',
      '192.0.2.0/24',
      '0.0.0.0/0',
    ]);
    expect(result.bestMatch).toEqual({
      prefix: '192.0.2.0/25',
      region: 'us-east-1',
      service: 'S3',
      network_border_group: 'us-east-1',
      type: 'ipv4',
    });
    expect(result.contained).toEqual([]);
    expect(result.containedTotal).toBe(0);
  });

  it('returns an empty result when nothing contains or overlaps the address', () => {
    const result = lookupContainingPrefixes(withoutDefault, '203.0.113.5');

    expect(result).toEqual({
      query: '203.0.113.5',
      version: 'ipv4',
      found: false,
      bestMatch: null,
      containing: [],
      contained: [],
      containedTotal: 0,
      containedTruncated: false,
    });
  });

  it('matches an IPv4 CIDR as containing only when it is fully inside the prefix', () => {
    const inside = lookupContainingPrefixes(withoutDefault, '192.0.2.200/28');
    const exact = lookupContainingPrefixes(withoutDefault, '192.0.2.128/25');

    expect(cidrs(inside.containing)).toEqual([
      '192.0.2.128/25',
      '192.0.2.0/24',
    ]);
    expect(cidrs(exact.containing)).toEqual(['192.0.2.128/25', '192.0.2.0/24']);
    expect(exact.contained).toEqual([]);
  });

  it('normalizes host bits in an IPv4 CIDR to the network address', () => {
    const result = lookupContainingPrefixes(dataset, '192.0.2.10/24');

    expect(result.query).toBe('192.0.2.0/24');
    expect(cidrs(result.containing)).toEqual(['192.0.2.0/24', '0.0.0.0/0']);
  });

  it('accepts compressed and uppercase IPv6 and ranks the containing prefixes', () => {
    const result = lookupContainingPrefixes(dataset, '2001:DB8:1:2::A');

    expect(result.query).toBe('2001:db8:1:2::a');
    expect(result.version).toBe('ipv6');
    expect(result.found).toBe(true);
    expect(
      result.containing.map((match) => `${match.prefix} ${match.service}`)
    ).toEqual([
      '2001:db8:1:2::/64 S3',
      '2001:db8:1::/48 CLOUDFRONT',
      '2001:db8::/32 EC2',
    ]);
    expect(result.bestMatch).toMatchObject({
      prefix: '2001:db8:1:2::/64',
      region: 'eu-west-1',
      service: 'S3',
      type: 'ipv6',
    });
  });

  it('matches an IPv6 CIDR as containing only when it sits fully inside the prefix', () => {
    const inside = lookupContainingPrefixes(dataset, '2001:db8:1:2:3::/80');
    const otherBlock = lookupContainingPrefixes(dataset, '2001:db9::1');
    const onlyTheAggregate = lookupContainingPrefixes(dataset, '2001:db8:2::1');

    expect(inside.query).toBe('2001:db8:1:2:3::/80');
    expect(cidrs(inside.containing)).toEqual([
      '2001:db8:1:2::/64',
      '2001:db8:1::/48',
      '2001:db8::/32',
    ]);
    expect(otherBlock.found).toBe(false);
    expect(cidrs(onlyTheAggregate.containing)).toEqual(['2001:db8::/32']);
  });

  it('honors IPv6 prefix lengths that are not a multiple of 16', () => {
    const prefixes = [
      prefix('2001:db8::/32', 'ipv6', { service: 'AMAZON' }),
      prefix('2001:db8:8000::/33', 'ipv6', { service: 'EC2' }),
    ];

    const upper = lookupContainingPrefixes(prefixes, '2001:db8:8000::1');
    const lower = lookupContainingPrefixes(prefixes, '2001:db8:4000::1');
    const upperCidr = lookupContainingPrefixes(prefixes, '2001:db8:c000::/34');

    expect(cidrs(upper.containing)).toEqual([
      '2001:db8:8000::/33',
      '2001:db8::/32',
    ]);
    expect(cidrs(lower.containing)).toEqual(['2001:db8::/32']);
    expect(upperCidr.query).toBe('2001:db8:c000::/34');
    expect(cidrs(upperCidr.containing)).toEqual([
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
    expect(cidrs(result.containing)).toEqual(['2001:db8::/32']);
  });

  it('does not match an address against the other IP family', () => {
    const result = lookupContainingPrefixes(
      [prefix('2001:db8::/32', 'ipv6')],
      '192.0.2.1'
    );

    expect(result.found).toBe(false);
    expect(result.containing).toEqual([]);
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

    expect(ipv4.containing).toHaveLength(1);
    expect(ipv6.containing).toHaveLength(1);
    expect(ipv6.query).toBe('2001:db8::1');
  });

  it('skips malformed dataset rows and rows whose type disagrees with the address', () => {
    const rows = [
      prefix('not-a-prefix', 'ipv4'),
      prefix('2001:db8::/32', 'ipv4'),
      prefix('192.0.2.0/24', 'ipv4'),
    ];
    const index = buildPrefixIndex(rows);
    const result = lookupPrefixes(index, '192.0.2.1');

    expect(index.skipped).toBe(2);
    expect(cidrs(result.containing)).toEqual(['192.0.2.0/24']);
  });
});

describe('ranking', () => {
  it('sorts by prefix length, then a named service before AMAZON, then region', () => {
    const input = [
      prefix('10.0.0.0/8', 'ipv4', { service: 'AMAZON', region: 'us-east-1' }),
      prefix('10.1.0.0/16', 'ipv4', { service: 'AMAZON', region: 'us-east-1' }),
      prefix('10.1.0.0/16', 'ipv4', { service: 'EC2', region: 'us-west-2' }),
      prefix('10.1.0.0/16', 'ipv4', { service: 'EC2', region: 'eu-west-1' }),
      prefix('10.1.2.0/24', 'ipv4', { service: 'AMAZON', region: 'us-east-1' }),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));

    const result = lookupContainingPrefixes(input, '10.1.2.9');

    expect(
      result.containing.map((m) => `${m.prefix} ${m.service} ${m.region}`)
    ).toEqual([
      '10.1.2.0/24 AMAZON us-east-1',
      '10.1.0.0/16 EC2 eu-west-1',
      '10.1.0.0/16 EC2 us-west-2',
      '10.1.0.0/16 AMAZON us-east-1',
      '10.0.0.0/8 AMAZON us-east-1',
    ]);
    expect(result.bestMatch?.prefix).toBe('10.1.2.0/24');
    expect(input).toEqual(snapshot);
  });

  it('does not depend on dataset order', () => {
    const forward = [
      prefix('10.0.0.0/8', 'ipv4', { service: 'AMAZON' }),
      prefix('10.1.2.0/24', 'ipv4', { service: 'EC2' }),
    ];
    const reversed = [...forward].reverse();

    expect(lookupContainingPrefixes(forward, '10.1.2.3')).toEqual(
      lookupContainingPrefixes(reversed, '10.1.2.3')
    );
  });
});

describe('overlapping (broader) CIDR queries', () => {
  it('reports published prefixes inside a broader query instead of "not found"', () => {
    const result = lookupContainingPrefixes(withoutDefault, '192.0.2.0/23');

    expect(result.found).toBe(true);
    expect(result.bestMatch).toBeNull();
    expect(result.containing).toEqual([]);
    expect(cidrs(result.contained)).toEqual([
      '192.0.2.0/24',
      '192.0.2.0/25',
      '192.0.2.128/25',
    ]);
    expect(result.containedTotal).toBe(3);
    expect(result.containedTruncated).toBe(false);
  });

  it('returns both groups when a query is contained and also contains prefixes', () => {
    const result = lookupContainingPrefixes(withoutDefault, '192.0.2.0/24');

    expect(cidrs(result.containing)).toEqual(['192.0.2.0/24']);
    expect(cidrs(result.contained)).toEqual(['192.0.2.0/25', '192.0.2.128/25']);
  });

  it('handles 3.0.0.0/8 against a published 3.0.0.0/9', () => {
    const result = lookupContainingPrefixes(
      [prefix('3.0.0.0/9', 'ipv4', { service: 'AMAZON' })],
      '3.0.0.0/8'
    );

    expect(result.found).toBe(true);
    expect(result.containing).toEqual([]);
    expect(cidrs(result.contained)).toEqual(['3.0.0.0/9']);
  });

  it('caps the contained list and reports the total', () => {
    const many = Array.from({ length: 150 }, (_, i) =>
      prefix(`10.0.${i}.0/24`, 'ipv4')
    );

    const capped = lookupContainingPrefixes(many, '10.0.0.0/16');
    const custom = lookupContainingPrefixes(many, '10.0.0.0/16', {
      containedLimit: 5,
    });

    expect(capped.contained).toHaveLength(100);
    expect(capped.containedTotal).toBe(150);
    expect(capped.containedTruncated).toBe(true);
    expect(capped.contained[0].prefix).toBe('10.0.0.0/24');
    expect(capped.contained[99].prefix).toBe('10.0.99.0/24');
    expect(cidrs(custom.contained)).toHaveLength(5);
  });

  it('finds IPv6 prefixes inside a broader IPv6 query', () => {
    const result = lookupContainingPrefixes(dataset, '2001:db8::/16');

    expect(result.containing).toEqual([]);
    expect(cidrs(result.contained)).toEqual([
      '2001:db8::/32',
      '2001:db8:1::/48',
      '2001:db8:1:2::/64',
    ]);
  });

  it('treats 0.0.0.0/0 as containing every published IPv4 prefix', () => {
    const result = lookupContainingPrefixes(
      [prefix('192.0.2.0/24', 'ipv4')],
      '0.0.0.0/0'
    );

    expect(result.found).toBe(true);
    expect(result.containing).toEqual([]);
    expect(result.containedTotal).toBe(1);
  });
});

describe('IPv4-mapped IPv6', () => {
  const v4 = [prefix('3.5.16.0/21', 'ipv4', { service: 'S3' })];

  it('unwraps ::ffff:a.b.c.d and looks it up as IPv4', () => {
    const result = lookupContainingPrefixes(v4, '::ffff:3.5.16.1');

    expect(result.query).toBe('::ffff:3.5.16.1');
    expect(result.mappedIPv4).toBe('3.5.16.1');
    expect(result.version).toBe('ipv4');
    expect(cidrs(result.containing)).toEqual(['3.5.16.0/21']);
  });

  it('accepts the hex form and displays it dotted (RFC 5952 section 5)', () => {
    const result = lookupContainingPrefixes(v4, '::FFFF:305:1001');

    expect(result.query).toBe('::ffff:3.5.16.1');
    expect(result.mappedIPv4).toBe('3.5.16.1');
    expect(cidrs(result.containing)).toEqual(['3.5.16.0/21']);
  });

  it('maps a /96+ CIDR to the matching IPv4 CIDR', () => {
    const result = lookupContainingPrefixes(v4, '::ffff:3.5.16.0/120');

    expect(result.query).toBe('::ffff:3.5.16.0/120');
    expect(result.mappedIPv4).toBe('3.5.16.0/24');
    expect(cidrs(result.containing)).toEqual(['3.5.16.0/21']);
  });

  it('does not unwrap other IPv6 addresses', () => {
    const result = lookupContainingPrefixes(v4, '::3.5.16.1');

    expect(result.mappedIPv4).toBeUndefined();
    expect(result.version).toBe('ipv6');
    expect(result.found).toBe(false);
  });
});

describe('input handling', () => {
  it('strips an IPv6 zone id', () => {
    expect(normalizeQuery('fe80::1%eth0')).toBe('fe80::1');
    expect(normalizeQuery('fe80::%25en0/64')).toBe('fe80::/64');
  });

  it('strips brackets around an IPv6 address', () => {
    expect(normalizeQuery('[2600::1]')).toBe('2600::1');
    expect(normalizeQuery('[2600::1]/64')).toBe('2600::/64');
  });

  it('accepts /0 and trims surrounding whitespace', () => {
    expect(normalizeQuery('  10.1.2.3/0 ')).toBe('0.0.0.0/0');
    expect(normalizeQuery('::/0')).toBe('::/0');
  });

  it('rejects IPv4 octets with leading zeros as ambiguous', () => {
    expect(() => normalizeQuery('010.1.2.3')).toThrow(/leading zero/);
    expect(() => normalizeQuery('010.1.2.3')).toThrow(/octal/);
    expect(() => normalizeQuery('::ffff:10.01.2.3')).toThrow(/leading zero/);
  });

  it('rejects prefix lengths with leading zeros', () => {
    expect(() => normalizeQuery('10.0.0.0/032')).toThrow(/leading zero/);
    expect(() => normalizeQuery('10.0.0.0/00')).toThrow(/leading zero/);
  });

  it('truncates long input in error messages', () => {
    const junk = 'x'.repeat(120);
    let message = '';
    try {
      normalizeQuery(junk);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(`"${'x'.repeat(64)}…"`);
    expect(message).not.toContain('x'.repeat(65));
  });

  it.each([
    '',
    '   ',
    'not-an-ip',
    '256.1.1.1',
    '192.0.2.1/33',
    '192.0.2.1/abc',
    '192.0.2.1/',
    '/24',
    '1.2.3',
    '1.2.3.4.5',
    '2001:db8::/129',
    '2001:db8:::1',
    'gggg::1',
    '192.0.2.1/24/32',
    '[192.0.2.1]',
    '[2600::1',
    '2600::1]',
    '192.0.2.1%eth0',
    'fe80::1%',
    '1.2.3.4 5',
    'x'.repeat(200),
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

describe('isValidCidr', () => {
  it('requires an explicit prefix length and strict syntax', () => {
    expect(isValidCidr('2001:db8::/32')).toBe(true);
    expect(isValidCidr('10.0.0.0/8')).toBe(true);
    expect(isValidCidr('10.0.0.0')).toBe(false);
    expect(isValidCidr('[2001:db8::]/32')).toBe(false);
    expect(isValidCidr(' 10.0.0.0/8')).toBe(false);
    expect(isValidCidr('010.0.0.0/8')).toBe(false);
  });
});

describe('getPrefixIndex', () => {
  const data = (syncToken: string, ip: string): AWSIPRanges => ({
    syncToken,
    createDate: '2024-01-01-00-00-00',
    prefixes: [
      {
        ip_prefix: ip,
        region: 'us-east-1',
        service: 'EC2',
        network_border_group: 'us-east-1',
      },
    ],
    ipv6_prefixes: [],
  });

  it('reuses the index for the same dataset version and rebuilds on change', () => {
    const first = getPrefixIndex(data('1', '192.0.2.0/24'));
    const again = getPrefixIndex(data('1', '192.0.2.0/24'));
    const next = getPrefixIndex(data('2', '198.51.100.0/24'));

    expect(again).toBe(first);
    expect(next).not.toBe(first);
    expect(cidrs(lookupPrefixes(next, '198.51.100.1').containing)).toEqual([
      '198.51.100.0/24',
    ]);
  });
});
