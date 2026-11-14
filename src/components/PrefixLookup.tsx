'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle, Copy, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAWSIPRanges } from '@/hooks/useAWSIPRanges';
import {
  getPrefixIndex,
  InvalidLookupQueryError,
  lookupPrefixes,
  PrefixLookupResult,
} from '@/lib/lookup';
import { cn, copyToClipboard } from '@/lib/utils';
import { CombinedPrefix } from '@/types';

type LookupState =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: PrefixLookupResult };

function summaryLine(query: string, match: CombinedPrefix): string {
  return `${query} is in ${match.prefix} (${match.service}, ${match.region}, ${match.network_border_group})`;
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/**
 * "Which AWS prefix contains this IP?"
 *
 * Runs entirely in the browser against the dataset the page has already
 * loaded (shared SWR cache), using the same lookup code as the public
 * /api/aws-ip-ranges/lookup endpoint. No request per lookup, no rate limit.
 */
export function PrefixLookup() {
  const { data, isLoading, error: loadError } = useAWSIPRanges();
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const index = useMemo(() => (data ? getPrefixIndex(data) : null), [data]);

  const state: LookupState = useMemo(() => {
    if (submitted === null) return { status: 'idle' };
    if (!submitted.trim()) {
      return {
        status: 'error',
        message: 'Enter an IPv4 address, IPv6 address, or CIDR prefix.',
      };
    }
    if (!index) {
      if (loadError && !isLoading) {
        return {
          status: 'error',
          message: 'AWS IP ranges could not be loaded. Please try again later.',
        };
      }
      return { status: 'waiting' };
    }
    try {
      return { status: 'done', result: lookupPrefixes(index, submitted) };
    } catch (error) {
      if (error instanceof InvalidLookupQueryError) {
        return { status: 'error', message: error.message };
      }
      return { status: 'error', message: 'Lookup failed. Please try again.' };
    }
  }, [submitted, index, loadError, isLoading]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(value);
  };

  const handleCopy = async (key: string, text: string) => {
    const success = await copyToClipboard(text);
    if (!success) return;
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 2000);
  };

  const renderRow = (
    match: CombinedPrefix,
    key: string,
    options: { best?: boolean; query?: string } = {}
  ) => {
    const summaryKey = `${key}-summary`;
    const cidrKey = `${key}-cidr`;
    return (
      <li
        key={key}
        data-testid={options.best ? 'best-match' : undefined}
        aria-current={options.best ? 'true' : undefined}
        className={cn(
          'space-y-3 p-4',
          options.best && 'bg-primary/5 ring-2 ring-inset ring-primary'
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-mono text-sm font-medium">
              {match.prefix}
              {options.best && (
                <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 font-sans text-xs font-medium text-primary-foreground">
                  Best match
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {match.service} · {match.region} · {match.network_border_group}
              <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                {match.type.toUpperCase()}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {options.query && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  handleCopy(summaryKey, summaryLine(options.query!, match))
                }
              >
                {copiedKey === summaryKey ? (
                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copy summary
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy(cidrKey, match.prefix)}
            >
              {copiedKey === cidrKey ? (
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy CIDR
            </Button>
          </div>
        </div>
      </li>
    );
  };

  const result = state.status === 'done' ? state.result : null;
  const isRange = result ? result.query.includes('/') : false;

  return (
    <section className="space-y-4 p-6 bg-card rounded-lg border">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          Which AWS prefix contains this IP?
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste an IPv4 or IPv6 address, or a CIDR. You get the published AWS
          prefixes that contain it, most specific first. For a CIDR you also see
          any published prefixes that fall inside it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="prefix-lookup" className="sr-only">
            IP address or CIDR
          </label>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="prefix-lookup"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="3.5.16.1 or 2600:1ff8:2c00::1"
            autoComplete="off"
            spellCheck={false}
            maxLength={256}
            className="pl-10 font-mono"
          />
        </div>
        <Button type="submit">Look up</Button>
      </form>

      <div aria-live="polite" className="space-y-3">
        {state.status === 'waiting' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
            Loading the published AWS ranges…
          </div>
        )}

        {state.status === 'error' && (
          <div
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.message}
          </div>
        )}

        {result && result.mappedIPv4 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{result.query}</span> is
            an IPv4-mapped IPv6 address, so it was looked up as{' '}
            <span className="font-mono text-foreground">
              {result.mappedIPv4}
            </span>
            .
          </p>
        )}

        {result && !result.found && (
          <div className="rounded-md border bg-muted/50 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">
              Not in the published AWS ranges
            </p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-mono">{result.query}</span> is not inside
              any prefix AWS has published
              {isRange ? ', and no published prefix falls inside it' : ''}.
            </p>
          </div>
        )}

        {result && result.containing.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {plural(
                  result.containing.length,
                  'prefix contains',
                  'prefixes contain'
                )}
              </span>{' '}
              <span className="font-mono text-foreground">{result.query}</span>
              {result.containing.length > 1 ? ', most specific first' : ''}
            </p>
            <ul
              className="divide-y rounded-md border"
              aria-label="Containing prefixes"
            >
              {result.containing.map((match, i) =>
                renderRow(
                  match,
                  `containing-${i}-${match.prefix}-${match.service}-${match.region}`,
                  {
                    best: i === 0,
                    query: result.query,
                  }
                )
              )}
            </ul>
          </div>
        )}

        {result && result.containedTotal > 0 && (
          <div className="space-y-2">
            {result.containing.length === 0 ? (
              <div className="rounded-md border bg-muted/50 px-3 py-3 text-sm">
                <p className="font-medium text-foreground">
                  No single published prefix contains this whole range
                </p>
                <p className="mt-1 text-muted-foreground">
                  But{' '}
                  {plural(
                    result.containedTotal,
                    'AWS prefix falls',
                    'AWS prefixes fall'
                  )}{' '}
                  inside <span className="font-mono">{result.query}</span>.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {plural(
                    result.containedTotal,
                    'more specific prefix falls',
                    'more specific prefixes fall'
                  )}
                </span>{' '}
                inside{' '}
                <span className="font-mono text-foreground">
                  {result.query}
                </span>
              </p>
            )}
            {result.containedTruncated && (
              <p className="text-xs text-muted-foreground">
                Showing the first {result.contained.length.toLocaleString()} of{' '}
                {result.containedTotal.toLocaleString()}, in address order. Use
                a narrower range or the search table below to see the rest.
              </p>
            )}
            <ul
              className="divide-y rounded-md border"
              aria-label="Prefixes inside the range"
            >
              {result.contained.map((match, i) =>
                renderRow(
                  match,
                  `contained-${i}-${match.prefix}-${match.service}-${match.region}`
                )
              )}
            </ul>
          </div>
        )}

        {result && data && (
          <p className="text-xs text-muted-foreground">
            Checked in your browser against ip-ranges.json published{' '}
            {data.createDate}.
          </p>
        )}
      </div>
    </section>
  );
}
