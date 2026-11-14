# IPMapAWS 🗺️

A comprehensive Next.js web application and REST API for exploring AWS IP address ranges. Built for network engineers, infrastructure teams, and developers who need programmatic access to AWS IP data.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftengfone%2Fipmapaws)

## ✨ Features

### 🌐 Web Interface

- **Prefix Lookup**: Paste an IP or CIDR and see which published AWS prefix contains it (runs in your browser)
- **Advanced Search & Filtering**: Filter by region, service, CIDR notation, IPv4/IPv6
- **Fresh Data**: Read straight from AWS's official `ip-ranges.json`, refreshed hourly
- **Interactive Tables**: Sortable, paginated results with copy-to-clipboard
- **CSV Export**: Export filtered results for external analysis
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS
- **SEO Optimized**: Static generation for all region/service combinations
- **Dark Mode**: Automatic theme detection and switching

### 🚀 Public REST API

- **4 Endpoints**: Prefix lookup, raw data, advanced search, and export
- **Rate Limited**: Fair usage policies with different limits per endpoint
- **OpenAPI 3.0**: Complete specification with interactive documentation
- **No Authentication**: Free public access with transparent rate limits
- **JSON Responses**: Clean, consistent API responses
- **CORS Enabled**: Any site can call the API from the browser (`Access-Control-Allow-Origin: *`)

### 📊 Data & Performance

- **No Database or Storage**: Data comes straight from AWS's `ip-ranges.json`, which AWS serves from its own CDN
- **Smart Caching**: Pages regenerate hourly (ISR) and API responses are cached on Vercel's CDN
- **Real-time Stats**: Live data freshness indicators
- **High Availability**: If AWS is briefly unreachable, the last good copy keeps being served

## 🚀 Quick Start

### Prerequisites

- Node.js 20.9+ (CI uses Node 24)
- npm 8+

### Installation

```bash
# Clone the repository
git clone https://github.com/tengfone/ipmapaws
cd ipmapaws

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## 📡 Public API

### Base URL

- **Production**: `https://ipmapaws.vercel.app`
- **Documentation**: `https://ipmapaws.vercel.app/docs`

### Endpoints

#### 🎯 GET `/api/aws-ip-ranges/lookup`

Find the published AWS prefixes that contain an IP address or CIDR.

**Rate Limit**: 10 requests/minute

**Parameters**:

- `q` (string, required): IPv4 or IPv6 address or CIDR, e.g. `3.5.16.1`, `2600:1ff8:2c00::1`, `3.0.0.0/8`

```bash
curl "https://ipmapaws.vercel.app/api/aws-ip-ranges/lookup?q=3.5.16.1"
```

- `containing`: published prefixes that contain the whole query, most specific first (longest prefix, then a named service before the `AMAZON` aggregate, then region). `bestMatch` is the first of these, or `null`.
- `contained`: for a CIDR, published prefixes that fall inside it (address order, at most 100; `containedTotal` has the full count). So `3.0.0.0/8` reports the published `3.0.0.0/9` instead of "not found".
- `found` is `false` only when nothing contains or falls inside the query.
- IPv4-mapped IPv6 (`::ffff:3.5.16.1` or `::ffff:305:1001`) is looked up as IPv4 and reported in `mappedIPv4`. Brackets (`[2600::1]`) and zone ids (`fe80::1%eth0`) are stripped. Leading zeros in IPv4 octets (`010.1.2.3`) or prefix lengths (`/032`) are rejected as ambiguous.
- Invalid input returns HTTP 400 with an `error` and `message`.

Example response (illustrative; real values depend on the current `ip-ranges.json`):

```json
{
  "query": "3.5.16.1",
  "version": "ipv4",
  "found": true,
  "bestMatch": {
    "prefix": "3.5.16.0/21",
    "region": "eu-west-1",
    "service": "S3",
    "network_border_group": "eu-west-1",
    "type": "ipv4"
  },
  "containing": [
    {
      "prefix": "3.5.16.0/21",
      "region": "eu-west-1",
      "service": "S3",
      "network_border_group": "eu-west-1",
      "type": "ipv4"
    },
    {
      "prefix": "3.5.16.0/21",
      "region": "eu-west-1",
      "service": "AMAZON",
      "network_border_group": "eu-west-1",
      "type": "ipv4"
    }
  ],
  "contained": [],
  "containedTotal": 0,
  "containedTruncated": false,
  "syncToken": "1700000000",
  "createDate": "2023-11-14-22-13-20"
}
```

#### 📥 GET `/api/aws-ip-ranges`

Get the complete AWS IP ranges dataset in original Amazon format.

**Rate Limit**: 50 requests/hour

```bash
curl "https://ipmapaws.vercel.app/api/aws-ip-ranges"
```

#### 🔍 GET `/api/aws-ip-ranges/search`

Advanced search with filtering, sorting, and pagination.

**Rate Limit**: 10 requests/minute

**Parameters**:

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page, max 500 (default: 50)
- `regions` (string): Comma-separated AWS regions (e.g., "us-east-1,us-west-2")
- `services` (string): Comma-separated AWS services (e.g., "EC2,S3")
- `searchTerm` (string): Search term for IP ranges, regions, or services
- `includeIPv4` (boolean): Include IPv4 addresses (default: true)
- `includeIPv6` (boolean): Include IPv6 addresses (default: true)
- `sortField` (string): Sort by "prefix", "region", "service", or "network_border_group"
- `sortDirection` (string): "asc" or "desc" (default: "asc")

```bash
# Get EC2 ranges in us-east-1
curl "https://ipmapaws.vercel.app/api/aws-ip-ranges/search?regions=us-east-1&services=EC2"

# Search with pagination
curl "https://ipmapaws.vercel.app/api/aws-ip-ranges/search?page=2&limit=100&searchTerm=s3"
```

#### 📤 GET `/api/aws-ip-ranges/export`

Export filtered results (all matching records, no pagination).

**Rate Limit**: 5 requests/10 minutes

**Parameters**: Same as search endpoint (except page and limit)

```bash
# Export all S3 IPv4 ranges
curl "https://ipmapaws.vercel.app/api/aws-ip-ranges/export?services=S3&includeIPv6=false"
```

### Rate Limiting

Limits are per client IP and per endpoint (each endpoint has its own budget). All endpoints include standard rate limiting headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `X-RateLimit-Window`: Rate limit window in seconds

A `429` response also carries `Retry-After`. Counters are kept in memory, so on serverless hosting each instance counts separately: treat the limits as best effort, not a guarantee.

### Response Format

```json
{
  "data": [
    {
      "prefix": "192.0.2.0/24",
      "region": "us-east-1",
      "service": "EC2",
      "network_border_group": "us-east-1",
      "type": "ipv4"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "totalPages": 20,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🛠️ Tech Stack

### Core Framework

- **Next.js 16**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first styling
- **React 19**: Latest React features

### Data & API

- **SWR**: Client-side data fetching with caching
- **Custom Rate Limiting**: IP-based with multiple tier system
- **OpenAPI 3.0**: Complete API specification

### Development & Testing

- **Jest**: Unit and integration testing
- **React Testing Library**: Component testing
- **ESLint**: Code linting and formatting
- **TypeScript**: Static type checking

### Deployment & Performance

- **Vercel**: Serverless deployment platform
- **ISR**: Incremental Static Regeneration
- **Edge Caching**: Global CDN distribution

## 📂 Project Structure

```
IPMapAWS/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── aws-ip-ranges/ # Main API endpoints
│   │   │   └── docs/          # OpenAPI specification
│   │   ├── docs/              # API documentation page
│   │   ├── regions/           # Dynamic region pages
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── ui/               # Reusable UI components
│   │   └── pages/            # Page-specific components
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utility functions
│   │   ├── api.ts           # Data fetching logic
│   │   ├── rate-limit.ts    # Rate limiting middleware
│   │   ├── server-data.ts # Loads and caches AWS data on the server
│   │   └── swagger.ts       # OpenAPI configuration
│   └── types/               # TypeScript definitions
├── tests/                   # Test files
└── docs/                   # Additional documentation
```

## 🔧 Configuration

### Environment Variables

```bash
# Optional: Custom base URL (defaults to Vercel URL)
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

```

### Rate Limiting

Rate limits are configurable in `src/lib/rate-limit.ts`:

- **API General**: 50 requests/hour
- **Lookup**: 10 requests/minute
- **Search**: 10 requests/minute
- **Export**: 5 requests/10 minutes

Requests from the site's own pages (same-origin `Sec-Fetch-Site` or `Referer`) get a higher but finite per-IP limit so the UI stays usable. No header disables rate limiting. The limiter keys on `x-real-ip` / `x-forwarded-for`, which Vercel sets; behind another host, make sure a proxy overwrites them.

### Data Freshness

There is no database or storage to set up. Server code fetches AWS's `ip-ranges.json` directly (`src/lib/server-data.ts`) and keeps it in memory for an hour; region pages regenerate hourly and API responses are cached on the CDN. AWS publishes changes several times a week, so data is at most about an hour behind.

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Coverage

- **Unit Tests**: Core utilities and helpers
- **Integration Tests**: API endpoints and data processing
- **Component Tests**: React component behavior

## 📈 Performance

### Metrics

- **Lighthouse Score**: 95+ across all categories
- **First Contentful Paint**: <1.5s
- **Time to Interactive**: <3s
- **Core Web Vitals**: All green

### Optimizations

- **Static Generation**: Pre-rendered pages for all region/service combinations
- **ISR**: Fresh data without rebuild delays
- **Image Optimization**: Next.js automatic image optimization
- **Bundle Splitting**: Automatic code splitting and lazy loading

## 🛡️ Security & Reliability

### Rate Limiting

- **Multi-tier System**: Different limits for different endpoint types
- **IP-based Tracking**: Fair usage enforcement
- **No Header Bypass**: Website requests get a higher, still finite limit; the prefix lookup on the home page runs in the browser and makes no API calls
- **Client-side Protection**: UI prevents API spam

### Data Integrity

- **No Storage to Manage**: Nothing to provision, pay for or keep in sync
- **Automatic Validation**: Response structure verification
- **Fallback Handling**: Keeps serving the last good copy during AWS outages

### Error Handling

- **Graceful Failures**: User-friendly error messages
- **Retry Logic**: Automatic retry with exponential backoff
- **Monitoring**: Built-in error tracking and logging

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables (optional)
3. Deploy automatically on push to main branch

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftengfone%2Fipmapaws)

### Docker

```bash
# Build Docker image
docker build -t ipmapaws .

# Run container
docker run -p 3000:3000 ipmapaws
```

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `npm run test`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

### Code Standards

- **TypeScript**: All new code must be typed
- **Testing**: Add tests for new features
- **Documentation**: Update README and API docs
- **Linting**: Follow ESLint configuration

## 📊 API Usage Examples

### JavaScript/Node.js

```javascript
// Fetch EC2 ranges in us-east-1
const response = await fetch(
  'https://ipmapaws.vercel.app/api/aws-ip-ranges/search?regions=us-east-1&services=EC2'
);
const data = await response.json();
console.log(data.data); // Array of IP ranges
```

### Python

```python
import requests

# Get all S3 ranges
response = requests.get('https://ipmapaws.vercel.app/api/aws-ip-ranges/search?services=S3')
data = response.json()
for range_info in data['data']:
    print(f"{range_info['prefix']} - {range_info['region']}")
```

### cURL

```bash
# Export CloudFront ranges as JSON
curl -H "Accept: application/json" \
  "https://ipmapaws.vercel.app/api/aws-ip-ranges/export?services=CLOUDFRONT" \
  | jq '.data[].prefix'
```

## 🔗 Related Resources

- **AWS IP Ranges Documentation**: [https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html](https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html)
- **AWS Official IP Ranges**: [https://ip-ranges.amazonaws.com/ip-ranges.json](https://ip-ranges.amazonaws.com/ip-ranges.json)
- **Next.js Documentation**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **OpenAPI Specification**: [https://swagger.io/specification/](https://swagger.io/specification/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/tengfone/ipmapaws/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tengfone/ipmapaws/discussions)
- **API Docs**: [https://ipmapaws.vercel.app/docs](https://ipmapaws.vercel.app/docs)

## 🙏 Acknowledgments

- **AWS**: For providing the public IP ranges data
- **Vercel**: For the excellent deployment platform
- **Next.js Team**: For the amazing React framework
- **Community**: For feedback and contributions

---

**Built with ❤️ for the infrastructure community**
