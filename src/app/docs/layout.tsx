import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation',
  description:
    'REST API for AWS IP ranges: download the dataset, search by region and service, export CSV, and look up which AWS prefix contains an IP or CIDR.',
  alternates: { canonical: '/docs' },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
