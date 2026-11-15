import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ipRangesFixture } from '@/__fixtures__/ip-ranges';
import { ExportControls } from '../ExportControls';
import { PrefixLookup } from '../PrefixLookup';
import HomePage from '../pages/HomePage';
import { useAWSIPRanges, useAWSIPRangesSearch } from '@/hooks/useAWSIPRanges';
import {
  transformAWSIPRanges,
  extractRegions,
  extractServices,
} from '@/lib/api';
import { CombinedPrefix } from '@/types';

jest.mock('@/hooks/useAWSIPRanges', () => ({
  useAWSIPRanges: jest.fn(),
  useAWSIPRangesSearch: jest.fn(),
}));

const mockedRanges = useAWSIPRanges as jest.MockedFunction<
  typeof useAWSIPRanges
>;
const mockedSearch = useAWSIPRangesSearch as jest.MockedFunction<
  typeof useAWSIPRangesSearch
>;
const combined = transformAWSIPRanges(ipRangesFixture);

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('unexpected fetch'))
  ) as unknown as typeof fetch;
  mockedRanges.mockReturnValue({
    data: ipRangesFixture,
    combinedPrefixes: combined,
    regions: extractRegions(ipRangesFixture),
    services: extractServices(ipRangesFixture),
    stats: null,
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  });
  mockedSearch.mockImplementation((page, limit, filters) => ({
    data: combined.filter(
      (p) => !filters.regions.length || filters.regions.includes(p.region)
    ),
    pagination: {
      page: page ?? 1,
      limit: limit ?? 50,
      total: 3,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
    filters,
    sorting: { field: 'prefix' as const, direction: 'asc' as const },
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  }));
});

describe('bulk lookup', () => {
  it('looks up a pasted list, one row per entry, and draws the chosen row', async () => {
    const user = userEvent.setup();
    render(<PrefixLookup />);

    await user.click(screen.getByRole('button', { name: 'Look up a list' }));
    const box = screen.getByLabelText('IP addresses or CIDRs, one per line');
    await user.click(box);
    await user.paste(
      '3.5.16.1:443, 203.0.113.9\n[2600:1f14::1]\n999.1.2.3\nGET /index.html 200'
    );
    expect(screen.getByText(/entries/)).toHaveTextContent('4 entries');
    await user.click(screen.getByRole('button', { name: 'Look up all' }));

    const summary = screen.getByText(/invalid$/);
    expect(summary).toHaveTextContent('1 of 4 is AWS · 2 not AWS · 1 invalid');
    expect(screen.getByText(/without an address skipped/)).toHaveTextContent(
      '1 line without an address skipped.'
    );

    const table = screen.getByRole('table', { name: /Bulk lookup results/ });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText('3.5.16.0/21')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Not AWS/)).toBeInTheDocument();
    expect(within(rows[3]).getByText('Invalid')).toBeInTheDocument();

    // The first AWS row is drawn by default; choosing another redraws the plat.
    expect(screen.getByText('Plat of 3.5.16.1')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Draw the plat for 203.0.113.9' })
    );
    expect(
      screen.getByText('203.0.113.9 is outside every AWS lot')
    ).toBeInTheDocument();
  });
});

describe('ExportControls', () => {
  const rows: CombinedPrefix[] = combined;

  it('copies the matching rows as an allow-list format and stamps in place', async () => {
    const user = userEvent.setup();
    render(
      <ExportControls
        source={{ records: async () => rows }}
        filenameBase="test"
        totalCount={rows.length}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Copy as' }));
    await user.click(
      screen.getByRole('button', { name: 'Copy as nginx allow' })
    );

    expect(
      await screen.findByRole('button', { name: /^Copied \d+ CIDRs as nginx$/ })
    ).toBeInTheDocument();
    const text = await navigator.clipboard.readText();
    expect(text).toContain(
      'allow 3.0.0.0/9;\nallow 3.5.0.0/16;\nallow 3.5.16.0/21;'
    );
    expect(
      screen.queryByRole('group', { name: 'Copy or download as' })
    ).toBeNull();
  });

  it('is disabled when nothing matches', () => {
    render(
      <ExportControls
        source={{ records: async () => [] }}
        filenameBase="t"
        totalCount={0}
      />
    );
    expect(screen.getByRole('button', { name: 'Copy as' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeDisabled();
  });
});

describe('shareable URLs', () => {
  it('restores the lookup and register filters from the URL', async () => {
    window.history.replaceState(
      null,
      '',
      '/?ip=3.5.16.1&regions=eu-west-1&v=4&sort=-service'
    );
    render(<HomePage />);

    expect(await screen.findByTestId('matched-lot')).toHaveTextContent(
      '3.5.16.0/21'
    );
    expect(screen.getByLabelText('IP address or CIDR')).toHaveValue('3.5.16.1');
    const lastCall =
      mockedSearch.mock.calls[mockedSearch.mock.calls.length - 1];
    expect(lastCall[2]).toMatchObject({
      regions: ['eu-west-1'],
      includeIPv4: true,
      includeIPv6: false,
    });
    expect(lastCall[3]).toBe('service');
    expect(lastCall[4]).toBe('desc');
  });

  it('writes a new lookup into the URL without adding history', async () => {
    const user = userEvent.setup();
    const before = window.history.length;
    render(<HomePage />);

    await user.type(
      screen.getByLabelText('IP address or CIDR'),
      '2600:1f14::1'
    );
    await user.click(screen.getByRole('button', { name: 'Look up' }));

    expect(window.location.search).toBe('?ip=2600:1f14::1');
    expect(window.history.length).toBe(before);
  });

  it('copies a link to the current lookup', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?ip=3.5.16.1&q=s3');
    render(<HomePage />);

    const lot = await screen.findByTestId('matched-lot');
    await user.click(within(lot).getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(
      'http://localhost/?ip=3.5.16.1&q=s3'
    );
  });
});
