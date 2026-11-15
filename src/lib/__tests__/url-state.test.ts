import {
  DEFAULT_VIEW,
  parseViewParams,
  serializeViewParams,
} from '@/lib/url-state';

describe('view params', () => {
  it('reads every parameter', () => {
    expect(
      parseViewParams(
        '?ip=3.5.140.2&q=s3&regions=us-east-1,eu-west-1&services=CLOUDFRONT&v=4&sort=-region&page=3'
      )
    ).toEqual({
      ip: '3.5.140.2',
      q: 's3',
      regions: ['us-east-1', 'eu-west-1'],
      services: ['CLOUDFRONT'],
      v4: true,
      v6: false,
      sortField: 'region',
      sortDirection: 'desc',
      page: 3,
    });
  });

  it('falls back to defaults for missing or malformed values', () => {
    expect(parseViewParams('')).toEqual(DEFAULT_VIEW);
    expect(parseViewParams('?v=4,6&sort=nope&page=-2&regions=,,')).toEqual(
      DEFAULT_VIEW
    );
    expect(parseViewParams('?v=none')).toMatchObject({ v4: false, v6: false });
  });

  it('omits defaults and round-trips', () => {
    expect(serializeViewParams(DEFAULT_VIEW)).toBe('');
    const view = {
      ...DEFAULT_VIEW,
      ip: '2600:1f14::1',
      regions: ['us-east-1', 'eu-west-1'],
      v6: false,
      sortField: 'network_border_group' as const,
      page: 2,
    };
    const query = serializeViewParams(view);
    expect(query).toBe(
      'ip=2600:1f14::1&regions=us-east-1,eu-west-1&v=4&sort=group&page=2'
    );
    expect(parseViewParams(`?${query}`)).toEqual(view);
  });

  it('encodes what would break the query string', () => {
    const query = serializeViewParams({ ...DEFAULT_VIEW, q: 'a&b c/24' });
    expect(query).toBe('q=a%26b%20c/24');
    expect(parseViewParams(`?${query}`).q).toBe('a&b c/24');
  });
});
