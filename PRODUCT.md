# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Engineers identifying an IP.** Someone sees an unfamiliar address in logs, a firewall alert or a flow record and needs to know quickly whether it belongs to AWS, and if so which region, service and network border group.
- **People building allow-lists.** Network and security engineers pull every prefix for a region and/or service (for example CloudFront, or EC2 in us-east-1) to paste into a firewall, security group, WAF or proxy config, often as CSV.
- **API consumers.** Developers who call the public REST API from scripts or CI; for them the site is mostly documentation and a place to try requests.

## Product Purpose

Search, filter and export the IP ranges AWS publishes in `ip-ranges.json`, and answer "which AWS prefix contains this IP or CIDR?" in the browser. Success is a correct answer or a usable export in seconds, with the data's freshness visible.

## Positioning

Reads AWS's official `ip-ranges.json` directly (no database, no stale copy), does prefix lookup client-side, server-renders a page for every region and region/service pair, and offers a free, unauthenticated, CORS-enabled REST API with an OpenAPI 3.0 spec.

## Operating Context

Used mid-task, usually on a desktop next to a terminal, a cloud console or a firewall UI. Results are copied out one prefix at a time or exported as CSV. Region and region/service pages are reached from search engines.

## Capabilities and Constraints

- Prefix lookup for IPv4/IPv6 addresses and CIDRs, most specific match first; for a CIDR, also prefixes that fall inside it.
- Filters: free-text search, regions (multi-select), services (multi-select), IPv4/IPv6.
- Sortable, paginated table with copy-to-clipboard per prefix; CSV export of all matching records.
- Data freshness: AWS's `createDate` / sync token shown; pages regenerate hourly (ISR).
- Server-rendered `/regions/[region]` and `/regions/[region]/services/[service]` pages.
- API: `/api/aws-ip-ranges`, `/search`, `/lookup`, `/export`; docs at `/docs` (Swagger). Rate limited, no auth, CORS `*`.
- Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, lucide-react, SWR. Jest tests.
- The owner allows trimming or merging low-value sections of the homepage (the API promo banner, the export summary statistics) if the page gets clearer. Every capability above stays.

## Brand Commitments

The name "IPMapAWS" is in use; it was not made binding. No other brand assets.

## Evidence on Hand

Live AWS data (about 17,800 prefixes, 43 regions, 27 services at the time of writing). No testimonials, user counts or usage statistics exist; do not invent them.

## Product Principles

1. The answer before the browse: an IP question gets answered first, at the top.
2. Show the data's provenance and freshness, never imply more than AWS publishes.
3. Copy and export are first-class: whatever is on screen can leave the page cleanly.
4. The API is a peer of the UI, documented, not advertised.
