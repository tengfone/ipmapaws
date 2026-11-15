import Link from 'next/link';
import React from 'react';
import { CombinedPrefix } from '@/types';

export function Breadcrumbs({
  trail,
}: {
  trail: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-ink-2">
      <ol className="flex flex-wrap items-center gap-x-2">
        {trail.map((item, i) => (
          <li key={item.label} className="flex items-center gap-x-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="rounded-sm underline decoration-sage underline-offset-4 hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-mono text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function countVersions(prefixes: CombinedPrefix[]) {
  let ipv4 = 0;
  for (const p of prefixes) if (p.type === 'ipv4') ipv4 += 1;
  return { ipv4, ipv6: prefixes.length - ipv4 };
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="page pt-10">
      <div
        role="alert"
        className="rounded-lg border border-danger px-4 py-3 text-sm"
      >
        <h1 className="font-semibold text-danger">
          AWS IP ranges could not be loaded
        </h1>
        <p className="mt-1 text-ink">{message} Reload the page to try again.</p>
      </div>
    </div>
  );
}
