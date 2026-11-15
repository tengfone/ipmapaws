import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegionPage from '../pages/RegionPage';
import { CombinedPrefix } from '@/types';

// Server-rendered pages must not trigger the client-side download of the
// full dataset, so any fetch in these tests is a failure.
const fetchSpy = jest.fn(() => Promise.reject(new Error('unexpected fetch')));

function makePrefixes(count: number): CombinedPrefix[] {
  return Array.from({ length: count }, (_, i) => ({
    prefix: `10.${Math.floor(i / 256)}.${i % 256}.0/24`,
    region: 'us-east-1',
    service: i % 2 ? 'S3' : 'EC2',
    network_border_group: 'us-east-1',
    type: 'ipv4' as const,
  }));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/regions/us-east-1');
  fetchSpy.mockClear();
  global.fetch = fetchSpy as unknown as typeof fetch;
});

describe('RegionPage with server data', () => {
  it('renders the first page of rows immediately, without fetching', () => {
    render(
      <RegionPage
        region="us-east-1"
        initialData={{
          prefixes: makePrefixes(120),
          lastUpdated: '2026-11-14-00-00-00',
        }}
      />
    );

    const rows = screen.getAllByRole('row');
    // 50 data rows plus the header row.
    expect(rows).toHaveLength(51);
    expect(screen.queryByText(/Loading AWS IP ranges data/)).toBeNull();
    expect(screen.getByRole('link', { name: /^S3\b/ })).toHaveAttribute(
      'href',
      '/regions/us-east-1/services/S3'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows a different page of rows when paging', async () => {
    render(
      <RegionPage
        region="us-east-1"
        initialData={{ prefixes: makePrefixes(120) }}
      />
    );
    const firstPage = screen.getAllByRole('row')[1].textContent;

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(51);
    expect(rows[1].textContent).not.toBe(firstPage);
  });
});
