import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ipRangesFixture } from '@/__fixtures__/ip-ranges';
import { PrefixLookup } from '../PrefixLookup';
import { useAWSIPRanges } from '@/hooks/useAWSIPRanges';
import { AWSIPRanges } from '@/types';

jest.mock('@/hooks/useAWSIPRanges', () => ({
  useAWSIPRanges: jest.fn(),
}));

const mockedHook = useAWSIPRanges as jest.MockedFunction<typeof useAWSIPRanges>;

function setData(
  data: AWSIPRanges | undefined,
  extra: { isLoading?: boolean; error?: unknown } = {}
) {
  mockedHook.mockReturnValue({
    data,
    combinedPrefixes: [],
    regions: [],
    services: [],
    stats: null,
    isLoading: extra.isLoading ?? false,
    error: extra.error,
    mutate: jest.fn(),
  });
}

async function lookUp(query: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('IP address or CIDR'), query);
  await user.click(screen.getByRole('button', { name: 'Look up' }));
}

describe('PrefixLookup', () => {
  let fetchSpy: jest.Mock;

  beforeEach(() => {
    fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    setData(ipRangesFixture);
  });

  it('shows the most specific prefix as one lot with all its service records', async () => {
    render(<PrefixLookup />);
    await lookUp('3.5.16.1');

    const lot = screen.getByTestId('matched-lot');
    expect(within(lot).getByText('3.5.16.0/21')).toBeInTheDocument();
    expect(within(lot).getByText('Matched lot')).toBeInTheDocument();
    // S3 and AMAZON both list 3.5.16.0/21: one lot, both services.
    expect(within(lot).getByText('S3 · AMAZON')).toBeInTheDocument();
    // Region label and network border group.
    expect(within(lot).getAllByText('eu-west-1')).toHaveLength(2);
    expect(screen.getAllByTestId('matched-lot')).toHaveLength(1);
    expect(
      screen.getByText('3 prefixes (4 service records) contain')
    ).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Containing prefixes' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe(lot);
    expect(within(rows[1]).getByText('3.5.0.0/16')).toBeInTheDocument();
    expect(within(rows[2]).getByText('3.0.0.0/9')).toBeInTheDocument();
    // No second card repeats the matched prefix.
    expect(within(list).getAllByText('3.5.16.0/21')).toHaveLength(1);
  });

  it('draws the plat from the matched lot down to the queried point', async () => {
    render(<PrefixLookup />);
    await lookUp('3.5.16.1');

    const plat = screen.getByRole('img', { name: /contains 3\.5\.16\.1/ });
    expect(plat).toHaveAccessibleName(
      'block 3.0.0.0/8, which contains block 3.5.0.0/16, which contains lot 3.5.16.0/21, which contains 3.5.16.1.'
    );
    expect(screen.getByText('Plat of 3.5.16.1')).toBeInTheDocument();
  });

  it('shows a labelled example plat before the first lookup', () => {
    render(<PrefixLookup />);

    expect(screen.getByText(/Example plat of/)).toBeInTheDocument();
    expect(
      screen.getByText(/This is an example drawn from today/)
    ).toBeInTheDocument();
  });

  it('says why nothing is drawn for invalid input', async () => {
    render(<PrefixLookup />);
    await lookUp('not-an-ip');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not an IP address or CIDR'
    );
    expect(screen.getByText('Nothing to draw')).toBeInTheDocument();
  });

  it('stamps Copied on the copy button in place', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    render(<PrefixLookup />);
    await lookUp('3.5.16.1');

    const user = userEvent.setup();
    const best = screen.getByTestId('matched-lot');
    await user.click(within(best).getByRole('button', { name: 'Copy prefix' }));

    expect(await within(best).findByText('Copied')).toBeInTheDocument();
  });

  it('runs locally without calling the API', async () => {
    render(<PrefixLookup />);
    await lookUp('3.5.16.1');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('explains a broad range that only contains published prefixes', async () => {
    render(<PrefixLookup />);
    await lookUp('3.0.0.0/8');

    expect(
      screen.getByText('No single published prefix contains this whole range')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3 AWS prefixes \(4 service records\) fall/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Not in the published AWS ranges')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('matched-lot')).not.toBeInTheDocument();
    const inside = screen.getByRole('list', {
      name: 'Prefixes inside the range',
    });
    expect(within(inside).getAllByRole('listitem')).toHaveLength(3);
  });

  it('says when nothing contains or overlaps the query', async () => {
    render(<PrefixLookup />);
    await lookUp('203.0.113.0/24');

    expect(
      screen.getByText('Not in the published AWS ranges')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no published prefix falls inside it/)
    ).toBeInTheDocument();
  });

  it('explains an IPv4-mapped IPv6 lookup', async () => {
    render(<PrefixLookup />);
    await lookUp('::ffff:305:1001');

    expect(screen.getByText(/IPv4-mapped IPv6 address/)).toBeInTheDocument();
    expect(screen.getAllByText('::ffff:3.5.16.1').length).toBeGreaterThan(0);
    expect(screen.getByTestId('matched-lot')).toHaveTextContent('3.5.16.0/21');
  });

  it('shows the parser message for invalid input', async () => {
    render(<PrefixLookup />);
    await lookUp('010.1.2.3');

    expect(screen.getByRole('alert')).toHaveTextContent(/leading zero/);
  });

  it('waits for the dataset, then shows the result', async () => {
    setData(undefined, { isLoading: true });
    const { rerender } = render(<PrefixLookup />);
    await lookUp('3.5.16.1');

    expect(
      screen.getByText('Loading the published AWS ranges…')
    ).toBeInTheDocument();

    setData(ipRangesFixture);
    rerender(<PrefixLookup />);

    expect(screen.getByTestId('matched-lot')).toHaveTextContent('3.5.16.0/21');
  });
});
