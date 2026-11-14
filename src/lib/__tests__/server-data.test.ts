import { getAWSIPRangesServer, resetServerDataMemo } from '../server-data';

const sample = {
  syncToken: '1',
  createDate: '2026-11-14-00-00-00',
  prefixes: [{ ip_prefix: '3.5.0.0/19', region: 'us-east-1', service: 'EC2', network_border_group: 'us-east-1' }],
  ipv6_prefixes: [],
};

const ok = (body: unknown) => ({ ok: true, json: async () => body });

describe('getAWSIPRangesServer', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    resetServerDataMemo();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.useRealTimers();
  });

  it('fetches straight from AWS, never from this app over HTTP', async () => {
    fetchMock.mockResolvedValue(ok(sample));
    await expect(getAWSIPRangesServer()).resolves.toEqual(sample);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://ip-ranges.amazonaws.com/ip-ranges.json');
  });

  it('loads once and shares the result across concurrent callers', async () => {
    fetchMock.mockResolvedValue(ok(sample));
    await Promise.all([getAWSIPRangesServer(), getAWSIPRangesServer(), getAWSIPRangesServer()]);
    await getAWSIPRangesServer();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes after an hour and keeps the last good copy if AWS fails', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T00:00:00Z'));
    fetchMock.mockResolvedValueOnce(ok(sample));
    await getAWSIPRangesServer();

    jest.setSystemTime(new Date('2026-11-14T01:00:01Z'));
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(getAWSIPRangesServer()).resolves.toEqual(sample);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on an invalid AWS response when there is no earlier copy', async () => {
    fetchMock.mockResolvedValue(ok({ nope: true }));
    await expect(getAWSIPRangesServer()).rejects.toThrow('Invalid');
  });

  it('throws on an HTTP error when there is no earlier copy', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await expect(getAWSIPRangesServer()).rejects.toThrow('HTTP 503');
  });
});
