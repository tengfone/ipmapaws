'use client';

import React, { useState } from 'react';
import { CheckCircle, Copy, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { copyToClipboard } from '@/lib/utils';
import { CombinedPrefix } from '@/types';

interface LookupResponse {
  query: string;
  found: boolean;
  matches: CombinedPrefix[];
  error?: string;
  message?: string;
}

function summaryLine(query: string, match: CombinedPrefix): string {
  return `${query} is in ${match.prefix} (${match.service}, ${match.region}, ${match.network_border_group})`;
}

export function PrefixLookup() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();

    if (!query) {
      setResult(null);
      setError('Enter an IPv4 address, IPv6 address, or CIDR prefix.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/aws-ip-ranges/lookup?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: 'application/json',
            'X-Internal-Request': 'true',
          },
        }
      );
      const body = (await response.json()) as LookupResponse;

      if (!response.ok) {
        setError(
          body.message || body.error || 'Lookup failed. Please try again.'
        );
        return;
      }

      setResult(body);
    } catch {
      setError('Lookup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (key: string, text: string) => {
    const success = await copyToClipboard(text);
    if (!success) return;
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 2000);
  };

  return (
    <section className="space-y-4 p-6 bg-card rounded-lg border">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          Which AWS prefix contains this IP?
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste an IPv4 or IPv6 address, or a CIDR. The result is every
          published AWS prefix that contains it.
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
            className="pl-10 font-mono"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Looking up…' : 'Look up'}
        </Button>
      </form>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
          Looking up published ranges…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && !result.found && (
        <div className="rounded-md border bg-muted/50 px-3 py-3 text-sm">
          <p className="font-medium text-foreground">
            Not in the published AWS ranges
          </p>
          <p className="mt-1 text-muted-foreground">
            <span className="font-mono">{result.query}</span> is not inside any
            prefix AWS has published.
          </p>
        </div>
      )}

      {result && result.found && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {result.matches.length}
            </span>{' '}
            {result.matches.length === 1
              ? 'prefix contains'
              : 'prefixes contain'}{' '}
            <span className="font-mono text-foreground">{result.query}</span>
          </p>
          <ul className="divide-y rounded-md border">
            {result.matches.map((match, index) => {
              const summaryKey = `${index}-summary`;
              const cidrKey = `${index}-cidr`;
              return (
                <li
                  key={`${match.prefix}-${match.service}-${match.region}-${index}`}
                  className="space-y-3 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-mono text-sm font-medium">
                        {match.prefix}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {match.service} · {match.region} ·{' '}
                        {match.network_border_group}
                        <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {match.type.toUpperCase()}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCopy(
                            summaryKey,
                            summaryLine(result.query, match)
                          )
                        }
                      >
                        {copiedKey === summaryKey ? (
                          <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        Copy summary
                      </Button>
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
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
