import { getAWSIPRangesServer, resetServerDataMemo } from '../server-data';
import { getCachedData, setCachedData } from '../cache';

jest.mock('../cache', () => ({
  getCachedData: jest.fn(),
  setCachedData: jest.fn(() => Promise.resolve()),
}));

const sample = {
  syncToken: '1',
  createDate: '2026-11-14-00-00-00',
  prefixes: [{ ip_prefix: '3.5.0.0/19', region: 'us-east-1', service: 'EC2', network_border_group: 'us-east-1' }],
  ipv6_prefixes: [],
};

describe('getAWSIPRangesServer', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    resetServerDataMemo();
    jest.mocked(getCachedData).mockReset();
    jest.mocked(setCachedData).mockClear();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('uses cached data without any network call', async () => {
    jest.mocked(getCachedData).mockResolvedValue(sample as never);
    await expect(getAWSIPRangesServer()).resolves.toBe(sample);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to AWS directly, never to this app over HTTP', async () => {
    jest.mocked(getCachedData).mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: async () => sample });
    await expect(getAWSIPRangesServer()).resolves.toEqual(sample);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://ip-ranges.amazonaws.com/ip-ranges.json');
    expect(setCachedData).toHaveBeenCalledWith(sample);
  });

  it('loads once and shares the result across concurrent callers', async () => {
    jest.mocked(getCachedData).mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: async () => sample });
    await Promise.all([getAWSIPRangesServer(), getAWSIPRangesServer(), getAWSIPRangesServer()]);
    await getAWSIPRangesServer();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on an invalid AWS response', async () => {
    jest.mocked(getCachedData).mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ nope: true }) });
    await expect(getAWSIPRangesServer()).rejects.toThrow('Invalid');
  });

  it('throws on an HTTP error from AWS', async () => {
    jest.mocked(getCachedData).mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await expect(getAWSIPRangesServer()).rejects.toThrow('HTTP 503');
  });
});
