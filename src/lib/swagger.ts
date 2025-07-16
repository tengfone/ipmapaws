import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'IPMapAWS API',
    version: '1.0.0',
    description: 'A comprehensive API for accessing AWS IP ranges with search, filtering, and export capabilities',
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
      ServiceUnavailable: {
        description: 'Service temporarily unavailable (data syncing)',
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