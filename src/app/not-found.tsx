import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page pt-10 sm:pt-14">
      <h1 className="text-[26px] font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[28px]">
        Page not found
      </h1>
      <p className="mt-3 max-w-[60ch] text-ink-2">
        There is no page at this address. Region and service pages exist only
        for the regions and services AWS currently publishes in ip-ranges.json,
        so an old link may point at one that has gone.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-on-ink hover:bg-ink/85"
        >
          Look up an address
        </Link>
        <Link
          href="/#regions"
          className="inline-flex h-10 items-center rounded-md border border-ink px-4 text-sm font-semibold text-ink hover:bg-sage-tint"
        >
          Browse regions
        </Link>
      </div>
    </div>
  );
}
