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

  it('highlights the most specific prefix as the best match', async () => {
    render(<PrefixLookup />);
    await lookUp('3.5.16.1');

    const best = screen.getByTestId('best-match');
    expect(within(best).getByText('3.5.16.0/21')).toBeInTheDocument();
    expect(within(best).getByText('Best match')).toBeInTheDocument();
    expect(within(best).getByText(/S3 · eu-west-1/)).toBeInTheDocument();
    expect(screen.getAllByText('Best match')).toHaveLength(1);
    expect(screen.getByText(/4 prefixes contain/)).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Containing prefixes' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toBe(best);
    expect(within(rows[3]).getByText('3.0.0.0/9')).toBeInTheDocument();
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
    expect(screen.getByText(/4 AWS prefixes fall/)).toBeInTheDocument();
    expect(
      screen.queryByText('Not in the published AWS ranges')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('best-match')).not.toBeInTheDocument();
    const inside = screen.getByRole('list', {
      name: 'Prefixes inside the range',
    });
    expect(within(inside).getAllByRole('listitem')).toHaveLength(4);
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
    expect(screen.getByTestId('best-match')).toHaveTextContent('3.5.16.0/21');
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

    expect(screen.getByTestId('best-match')).toHaveTextContent('3.5.16.0/21');
  });
});
