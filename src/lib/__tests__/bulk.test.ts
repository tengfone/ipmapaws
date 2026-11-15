import { ipRangesFixture } from '@/__fixtures__/ip-ranges';
import {
  bulkRecords,
  bulkToCsv,
  candidateAddress,
  parseBulkInput,
  runBulkLookup,
  summarizeBulk,
} from '@/lib/bulk';
import { getPrefixIndex } from '@/lib/lookup';

const index = getPrefixIndex(ipRangesFixture);

describe('candidateAddress', () => {
  it.each([
    ['3.5.16.1', '3.5.16.1'],
    ['3.5.16.1:443', '3.5.16.1'],
    ['3.0.0.0/8', '3.0.0.0/8'],
    ['"3.5.16.1",', '3.5.16.1'],
    ['(3.5.16.1)', '3.5.16.1'],
    ['[2600:1f14::1]:8443', '2600:1f14::1'],
    ['[2600:1f14::1]', '2600:1f14::1'],
    ['2600:1f14::1', '2600:1f14::1'],
    ['999.1.2.3', '999.1.2.3'],
    ['10.0.0', '10.0.0'],
  ])('reads %s as %s', (token, expected) => {
    expect(candidateAddress(token)).toBe(expected);
  });

  it.each(['GET', '12:34:56', 'HTTP/1.1', '200', '1.1', '-', 'example.com'])(
    'ignores %s',
    (token) => {
      expect(candidateAddress(token)).toBeNull();
    }
  );
});

describe('parseBulkInput', () => {
  it('reads lines, commas and spaces and skips log noise', () => {
    const parsed = parseBulkInput(
      [
        '3.5.16.1, 8.8.8.8 [2600:1f14::1]:443',
        '2026-11-15 12:00:01 GET /index.html 200',
        '10.1.2.3 - - [15/Nov/2026:12:00:01 +0000] "GET / HTTP/1.1" 200',
        '',
        'not-an-ip',
      ].join('\n')
    );
    expect(parsed.tokens.map((t) => [t.input, t.query])).toEqual([
      ['3.5.16.1', '3.5.16.1'],
      ['8.8.8.8', '8.8.8.8'],
      ['[2600:1f14::1]:443', '2600:1f14::1'],
      ['10.1.2.3', '10.1.2.3'],
      ['not-an-ip', null],
    ]);
    expect(parsed.skippedLines).toBe(1);
    expect(parsed.truncated).toBe(false);
  });

  it('caps the number of entries and says how many there were', () => {
    const text = Array.from(
      { length: 1205 },
      (_, i) => `10.0.${i >> 8}.${i & 255}`
    ).join('\n');
    const parsed = parseBulkInput(text);
    expect(parsed.tokens).toHaveLength(1000);
    expect(parsed.total).toBe(1205);
    expect(parsed.truncated).toBe(true);
  });
});

describe('runBulkLookup', () => {
  const rows = runBulkLookup(
    index,
    parseBulkInput('3.5.16.1\n203.0.113.9\n999.1.2.3\nnope\n3.0.0.0/8').tokens
  );

  it('gives one row per entry with the most specific lot', () => {
    expect(rows.map((r) => r.status)).toEqual([
      'aws',
      'not-aws',
      'invalid',
      'invalid',
      'not-aws',
    ]);
    expect(rows[0].lot).toMatchObject({
      prefix: '3.5.16.0/21',
      services: ['S3', 'AMAZON'],
      regions: ['eu-west-1'],
    });
    expect(rows[2].error).toBe('IPv4 octet "999" is greater than 255');
    expect(rows[3].error).toBe('Not an IP address or CIDR');
    expect(rows[4].inside).toBe(3);
  });

  it('summarises, exports matched records and writes CSV', () => {
    expect(summarizeBulk(rows)).toEqual({
      total: 5,
      aws: 1,
      notAws: 2,
      invalid: 2,
    });
    expect(bulkRecords(rows).map((r) => r.service)).toEqual(['S3', 'AMAZON']);
    const csv = bulkToCsv(rows).split(/\r?\n/);
    expect(csv[0]).toBe(
      'input,status,prefix,services,region,network_border_group,note'
    );
    expect(csv[1]).toBe(
      '3.5.16.1,AWS,3.5.16.0/21,S3 AMAZON,eu-west-1,eu-west-1,'
    );
    expect(csv[3]).toContain('Invalid');
  });
});
