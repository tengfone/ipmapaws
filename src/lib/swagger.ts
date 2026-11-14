import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'IPMapAWS API',
    version: '1.0.0',
    description: 'Look up which published AWS prefix contains an IP or CIDR, and search, filter, or export AWS IP ranges',
    contact: {
      name: 'IPMapAWS',
      url: 'https://ipmapaws.vercel.app',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_BASE_URL || 'https://ipmapaws.vercel.app',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'AWS IP Ranges',
      description: 'Operations related to AWS IP address ranges',
    },
    {
      name: 'SEO',
      description: 'SEO-related endpoints',
    },
  ],
  components: {
    schemas: {
      AWSIPRange: {
        type: 'object',
        properties: {
          prefix: {
            type: 'string',
            description: 'IP prefix in CIDR notation',
            example: '192.0.2.0/24',
          },
          region: {
            type: 'string',
            description: 'AWS region',
            example: 'us-east-1',
          },
          service: {
            type: 'string',
            description: 'AWS service name',
            example: 'EC2',
          },
          network_border_group: {
            type: 'string',
            description: 'Network border group',
            example: 'us-east-1',
          },
          type: {
            type: 'string',
            enum: ['ipv4', 'ipv6'],
            description: 'IP address type',
            example: 'ipv4',
          },
        },
        required: ['prefix', 'region', 'service', 'network_border_group', 'type'],
      },
      AWSRawData: {
        type: 'object',
        properties: {
          syncToken: {
            type: 'string',
            description: 'AWS sync token',
            example: '1234567890',
          },
          createDate: {
            type: 'string',
            description: 'Date when the data was created by AWS',
            example: '2024-01-15-10-30-45',
          },
          prefixes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ip_prefix: { type: 'string', example: '192.0.2.0/24' },
                region: { type: 'string', example: 'us-east-1' },
                service: { type: 'string', example: 'EC2' },
                network_border_group: { type: 'string', example: 'us-east-1' },
              },
            },
          },
          ipv6_prefixes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ipv6_prefix: { type: 'string', example: '2001:db8::/32' },
                region: { type: 'string', example: 'us-east-1' },
                service: { type: 'string', example: 'EC2' },
                network_border_group: { type: 'string', example: 'us-east-1' },
              },
            },
          },
        },
      },
      LookupResponse: {
        type: 'object',
        required: [
          'query',
          'version',
          'found',
          'bestMatch',
          'containing',
          'contained',
          'containedTotal',
          'containedTruncated',
          'syncToken',
          'createDate',
        ],
        properties: {
          query: {
            type: 'string',
            description:
              'The query in canonical form: RFC 5952 for IPv6 (IPv4-mapped addresses dotted), host bits cleared for CIDRs',
            example: '3.5.16.1',
          },
          version: {
            type: 'string',
            enum: ['ipv4', 'ipv6'],
            description:
              'Address family the lookup ran against. An IPv4-mapped IPv6 query runs as ipv4.',
            example: 'ipv4',
          },
          mappedIPv4: {
            type: 'string',
            description:
              'Only present for an IPv4-mapped IPv6 query (::ffff:a.b.c.d): the IPv4 address or CIDR it was looked up as',
            example: '3.5.16.1',
          },
          found: {
            type: 'boolean',
            description:
              'True when at least one published prefix contains the query or falls inside it',
            example: true,
          },
          bestMatch: {
            description:
              'The most specific published prefix that contains the whole query (first item of containing), or null',
            nullable: true,
            allOf: [{ $ref: '#/components/schemas/AWSIPRange' }],
          },
          containing: {
            type: 'array',
            description:
              'Published prefixes that contain the whole query, most specific first (longest prefix, then a named service before AMAZON, then region)',
            items: { $ref: '#/components/schemas/AWSIPRange' },
          },
          contained: {
            type: 'array',
            description:
              'Published prefixes strictly inside the queried CIDR, in address order, at most 100',
            items: { $ref: '#/components/schemas/AWSIPRange' },
          },
          containedTotal: {
            type: 'integer',
            description: 'Number of published prefixes inside the queried CIDR before the cap',
            example: 0,
          },
          containedTruncated: {
            type: 'boolean',
            description: 'True when contained was cut off at 100',
            example: false,
          },
          syncToken: {
            type: 'string',
            description: 'syncToken of the ip-ranges.json version the lookup ran against',
            example: '1700000000',
          },
          createDate: {
            type: 'string',
            description: 'createDate of the ip-ranges.json version the lookup ran against',
            example: '2023-11-14-22-13-20',
          },
        },
        example: {
          query: '3.5.16.1',
          version: 'ipv4',
          found: true,
          bestMatch: {
            prefix: '3.5.16.0/21',
            region: 'eu-west-1',
            service: 'S3',
            network_border_group: 'eu-west-1',
            type: 'ipv4',
          },
          containing: [
            {
              prefix: '3.5.16.0/21',
              region: 'eu-west-1',
              service: 'S3',
              network_border_group: 'eu-west-1',
              type: 'ipv4',
            },
            {
              prefix: '3.5.16.0/21',
              region: 'eu-west-1',
              service: 'AMAZON',
              network_border_group: 'eu-west-1',
              type: 'ipv4',
            },
          ],
          contained: [],
          containedTotal: 0,
          containedTruncated: false,
          syncToken: '1700000000',
          createDate: '2023-11-14-22-13-20',
        },
      },
      SearchResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/AWSIPRange' },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 50 },
              total: { type: 'integer', example: 1000 },
              totalPages: { type: 'integer', example: 20 },
            },
          },
        },
      },
      ExportResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/AWSIPRange' },
          },
          total: {
            type: 'integer',
            description: 'Total number of records exported',
            example: 500,
          },
          exportedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the export was generated',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error type',
            example: 'Rate limit exceeded',
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
            example: 'Too many requests, please try again later.',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Error timestamp',
          },
        },
      },
      RateLimitError: {
        allOf: [
          { $ref: '#/components/schemas/Error' },
          {
            type: 'object',
            properties: {
              retryAfter: {
                type: 'integer',
                description: 'Seconds to wait before retrying',
                example: 60,
              },
              limit: {
                type: 'integer',
                description: 'Rate limit threshold',
                example: 100,
              },
              windowMs: {
                type: 'integer',
                description: 'Rate limit window in milliseconds',
                example: 3600000,
              },
            },
          },
        ],
      },
    },
    parameters: {
      LookupQuery: {
        name: 'q',
        in: 'query',
        description:
          'IPv4 address, IPv6 address, IPv4 CIDR, or IPv6 CIDR to look up (max 128 characters). IPv4-mapped IPv6 is looked up as IPv4; brackets and IPv6 zone ids are stripped; leading zeros in IPv4 octets or prefix lengths are rejected.',
        required: true,
        schema: {
          type: 'string',
          example: '3.5.16.1',
        },
      },
      Page: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1,
        },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page (max 500)',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
          default: 50,
        },
      },
      Regions: {
        name: 'regions',
        in: 'query',
        description: 'Comma-separated list of AWS regions to filter by',
        required: false,
        schema: {
          type: 'string',
          example: 'us-east-1,us-west-2',
        },
      },
      Services: {
        name: 'services',
        in: 'query',
        description: 'Comma-separated list of AWS services to filter by',
        required: false,
        schema: {
          type: 'string',
          example: 'EC2,S3',
        },
      },
      SearchTerm: {
        name: 'searchTerm',
        in: 'query',
        description: 'Search term to filter IP ranges, regions, or services',
        required: false,
        schema: {
          type: 'string',
          example: 'ec2',
        },
      },
      IncludeIPv4: {
        name: 'includeIPv4',
        in: 'query',
        description: 'Include IPv4 addresses in results',
        required: false,
        schema: {
          type: 'boolean',
          default: true,
        },
      },
      IncludeIPv6: {
        name: 'includeIPv6',
        in: 'query',
        description: 'Include IPv6 addresses in results',
        required: false,
        schema: {
          type: 'boolean',
          default: true,
        },
      },
      SortField: {
        name: 'sortField',
        in: 'query',
        description: 'Field to sort by',
        required: false,
        schema: {
          type: 'string',
          enum: ['prefix', 'region', 'service', 'network_border_group'],
          default: 'prefix',
        },
      },
      SortDirection: {
        name: 'sortDirection',
        in: 'query',
        description: 'Sort direction',
        required: false,
        schema: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'asc',
        },
      },
    },
    responses: {
      RateLimitExceeded: {
        description: 'Rate limit exceeded',
        headers: {
          'Retry-After': {
            description: 'Seconds to wait before retrying',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Limit': {
            description: 'Rate limit threshold',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Remaining': {
            description: 'Remaining requests in current window',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Reset': {
            description: 'Unix timestamp when rate limit resets',
            schema: { type: 'integer' },
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RateLimitError' },
          },
        },
      },
      InternalError: {
        description: 'Unexpected server error. The message is generic; details are only logged server-side.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: 'Failed to look up AWS IP ranges',
              message: 'An unexpected error occurred. Please try again later.',
              timestamp: '2024-01-01T00:00:00.000Z',
            },
          },
        },
      },
      ServiceUnavailable: {
        description: 'Service temporarily unavailable (data syncing)',
        headers: {
          'Retry-After': {
            description: 'Seconds to wait before retrying',
            schema: { type: 'integer' },
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/app/api/**/*.ts'], // Path to the API files
};

export const swaggerSpec = swaggerJSDoc(options); 