import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Public_Sans } from 'next/font/google';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import './globals.css';

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 'https://ipmapaws.vercel.app'
  ),
  title: {
    default: 'IPMapAWS - AWS IP Ranges Explorer',
    template: '%s | IPMapAWS',
  },
  description:
    'Find which AWS prefix contains an IP or CIDR, and search, filter and export the IP ranges AWS publishes by region and service.',
  keywords: ['AWS', 'IP ranges', 'CIDR', 'network', 'infrastructure', 'cloud'],
  authors: [{ name: 'IPMapAWS Team' }],
  creator: 'IPMapAWS',
  publisher: 'IPMapAWS',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ipmapaws.vercel.app',
    siteName: 'IPMapAWS',
    title: 'IPMapAWS - AWS IP Ranges Explorer',
    description: 'Search and filter AWS IP prefixes by region and service',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IPMapAWS - AWS IP Ranges Explorer',
    description: 'Search and filter AWS IP prefixes by region and service',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef0ec' },
    { media: '(prefers-color-scheme: dark)', color: '#11181d' },
  ],
};

const themeScript = `
try {
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
} catch (_) {}
`;

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const navLink =
  'rounded-sm px-1 py-1 text-sm font-medium text-ink underline-offset-[6px] decoration-sage decoration-1 hover:underline';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-rule">
            <div className="page flex h-14 items-center justify-between gap-3">
              <Link
                href="/"
                className="rounded-sm text-[17px] tracking-[-0.01em] text-ink"
              >
                <span className="font-bold">IPMap</span>
                <span className="font-normal">AWS</span>
              </Link>
              <nav
                aria-label="Main"
                className="flex items-center gap-2 sm:gap-5"
              >
                <Link href="/#regions" className={navLink}>
                  Regions
                </Link>
                <Link href="/docs" className={navLink}>
                  API docs
                </Link>
                <a
                  href="https://github.com/tengfone/ipmapaws"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${navLink} inline-flex items-center gap-1.5`}
                >
                  <GitHubMark className="size-4" />
                  <span className="sr-only sm:not-sr-only">GitHub</span>
                </a>
                <ThemeToggle />
              </nav>
            </div>
          </header>
          <main id="main" className="flex-1">
            {children}
          </main>
          <footer className="mt-16 border-t border-rule">
            <div className="page flex flex-col gap-2 py-6 text-sm text-ink-2 md:flex-row md:items-center md:justify-between">
              <p>
                Data from AWS&apos;s published{' '}
                <a
                  href="https://ip-ranges.amazonaws.com/ip-ranges.json"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-ink underline decoration-sage"
                >
                  ip-ranges.json
                </a>
                , read directly and refreshed hourly.
              </p>
              <p>
                <Link
                  href="/docs"
                  className="text-ink underline decoration-sage"
                >
                  REST API
                </Link>{' '}
                · Open source under the{' '}
                <a
                  href="https://github.com/tengfone/ipmapaws/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline decoration-sage"
                >
                  MIT License
                </a>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
