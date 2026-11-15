'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, ExternalLink, Play, X, LoaderCircle, RotateCcw, Clock } from 'lucide-react';

interface ApiEndpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters?: Array<{
    name: string;
    description: string;
    required: boolean;
    type: string;
    example?: string;
    enum?: string[];
  }>;
  rateLimit: string;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/aws-ip-ranges/lookup',
    summary: 'Find the AWS prefix that contains an IP or CIDR',
    description: 'Returns the published AWS prefixes that contain the address or CIDR, most specific first, with the most specific one as bestMatch. For a CIDR it also returns the published prefixes that fall inside the range (contained, up to 100). found is false only when nothing contains or falls inside the query. IPv4-mapped IPv6 (::ffff:a.b.c.d) is looked up as IPv4.',
    parameters: [
      { name: 'q', description: 'IPv4 address, IPv6 address, or CIDR prefix', required: true, type: 'string', example: '3.5.16.1' },
    ],
    rateLimit: '10 requests/minute',
  },
  {
    method: 'GET',
    path: '/api/aws-ip-ranges',
    summary: 'Get all AWS IP ranges',
    description: 'Returns the complete AWS IP ranges dataset in the original format from Amazon',
    rateLimit: '50 requests/hour',
  },
  {
    method: 'GET',
    path: '/api/aws-ip-ranges/search',
    summary: 'Search and filter AWS IP ranges',
    description: 'Search AWS IP ranges with advanced filtering, sorting, and pagination capabilities',
    parameters: [
      { name: 'page', description: 'Page number for pagination', required: false, type: 'integer', example: '1' },
      { name: 'limit', description: 'Number of items per page (max 500)', required: false, type: 'integer', example: '50' },
      { name: 'regions', description: 'Comma-separated list of AWS regions', required: false, type: 'string', example: 'us-east-1,us-west-2' },
      { name: 'services', description: 'Comma-separated list of AWS services', required: false, type: 'string', example: 'EC2,S3' },
      { name: 'searchTerm', description: 'Search term to filter IP ranges', required: false, type: 'string', example: 'ec2' },
      { name: 'includeIPv4', description: 'Include IPv4 addresses in results', required: false, type: 'boolean', example: 'true' },
      { name: 'includeIPv6', description: 'Include IPv6 addresses in results', required: false, type: 'boolean', example: 'true' },
      { name: 'sortField', description: 'Field to sort by', required: false, type: 'string', example: 'prefix', enum: ['prefix', 'region', 'service', 'network_border_group'] },
      { name: 'sortDirection', description: 'Sort direction (asc/desc)', required: false, type: 'string', example: 'asc', enum: ['asc', 'desc'] },
    ],
    rateLimit: '10 requests/minute',
  },
  {
    method: 'GET',
    path: '/api/aws-ip-ranges/export',
    summary: 'Export filtered AWS IP ranges',
    description: 'Export AWS IP ranges with filtering and sorting applied. Returns all matching records (no pagination)',
    parameters: [
      { name: 'regions', description: 'Comma-separated list of AWS regions', required: false, type: 'string', example: 'us-east-1,us-west-2' },
      { name: 'services', description: 'Comma-separated list of AWS services', required: false, type: 'string', example: 'EC2,S3' },
      { name: 'searchTerm', description: 'Search term to filter IP ranges', required: false, type: 'string', example: 'ec2' },
      { name: 'includeIPv4', description: 'Include IPv4 addresses in results', required: false, type: 'boolean', example: 'true' },
      { name: 'includeIPv6', description: 'Include IPv6 addresses in results', required: false, type: 'boolean', example: 'true' },
      { name: 'sortField', description: 'Field to sort by', required: false, type: 'string', example: 'prefix', enum: ['prefix', 'region', 'service', 'network_border_group'] },
      { name: 'sortDirection', description: 'Sort direction (asc/desc)', required: false, type: 'string', example: 'asc', enum: ['asc', 'desc'] },
    ],
    rateLimit: '5 requests/10 minutes',
  },
];

interface ApiResult {
  endpoint: string;
  response: any;
  error: string | null;
  status: number | null;
  isLoading: boolean;
}

interface ParameterValues {
  [key: string]: string;
}

interface ClientRateLimit {
  lastRequest: number;
  cooldown: number; // milliseconds to wait before next request
}

// Client-side rate limiting configuration per endpoint
const CLIENT_RATE_LIMITS: Record<string, { cooldown: number; message: string }> = {
  '/api/aws-ip-ranges/lookup': {
    cooldown: 10000,
    message: 'Please wait 10 seconds between lookup requests (Only Applicable to UI)'
  },
  '/api/aws-ip-ranges': { 
    cooldown: 10000, // 10 seconds between requests
    message: 'Please wait 10 seconds between requests to the main API (Only Applicable to UI)'
  },
  '/api/aws-ip-ranges/search': { 
    cooldown: 10000, // 10 seconds between requests
    message: 'Please wait 10 seconds between search requests (Only Applicable to UI)'
  },
  '/api/aws-ip-ranges/export': { 
    cooldown: 10000, // 10 seconds between requests
    message: 'Please wait 10 seconds between export requests (Only Applicable to UI)'
  },
};

export default function ApiDocsPage() {
  const [, setSpec] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [apiResults, setApiResults] = useState<Record<string, ApiResult>>({});
  const [parameterValues, setParameterValues] = useState<Record<string, ParameterValues>>({});
  const [clientRateLimits, setClientRateLimits] = useState<Record<string, ClientRateLimit>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ipmapaws.vercel.app';

  useEffect(() => {
    fetch('/api/docs')
      .then((res) => res.json())
      .then((data) => {
        setSpec(data);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to load API specification');
        setIsLoading(false);
      });

    // Initialize parameter values with defaults
    const initialValues: Record<string, ParameterValues> = {};
    API_ENDPOINTS.forEach(endpoint => {
      if (endpoint.parameters) {
        initialValues[endpoint.path] = {};
        endpoint.parameters.forEach(param => {
          if (param.example) {
            initialValues[endpoint.path][param.name] = param.example;
          }
        });
      }
    });
    setParameterValues(initialValues);
  }, []);

  // Update current time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const buildUrlFromParameters = (endpoint: ApiEndpoint): string => {
    let url = `${baseUrl}${endpoint.path}`;
    const values = parameterValues[endpoint.path] || {};
    
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      const params = endpoint.parameters
        .filter(p => values[p.name] && values[p.name].trim() !== '')
        .map(p => `${p.name}=${encodeURIComponent(values[p.name])}`)
        .join('&');
      if (params) {
        url += `?${params}`;
      }
    }
    return url;
  };

  const updateParameterValue = (endpointPath: string, paramName: string, value: string) => {
    setParameterValues(prev => ({
      ...prev,
      [endpointPath]: {
        ...prev[endpointPath],
        [paramName]: value,
      }
    }));
  };

  const resetParameters = (endpoint: ApiEndpoint) => {
    const resetValues: ParameterValues = {};
    if (endpoint.parameters) {
      endpoint.parameters.forEach(param => {
        if (param.example) {
          resetValues[param.name] = param.example;
        }
      });
    }
    setParameterValues(prev => ({
      ...prev,
      [endpoint.path]: resetValues,
    }));
  };

  const canMakeRequest = useCallback((endpointPath: string): { canRequest: boolean; remainingTime: number } => {
    const rateLimitConfig = CLIENT_RATE_LIMITS[endpointPath];
    if (!rateLimitConfig) return { canRequest: true, remainingTime: 0 };

    const lastRequest = clientRateLimits[endpointPath];
    if (!lastRequest) return { canRequest: true, remainingTime: 0 };

    const timeSinceLastRequest = currentTime - lastRequest.lastRequest;
    const remainingTime = Math.max(0, rateLimitConfig.cooldown - timeSinceLastRequest);

    return {
      canRequest: remainingTime === 0,
      remainingTime
    };
  }, [clientRateLimits, currentTime]);

  const testEndpoint = async (endpoint: ApiEndpoint) => {
    const { canRequest, remainingTime } = canMakeRequest(endpoint.path);
    
    if (!canRequest) {
      // Show rate limit message in result
      const key = endpoint.path;
      setApiResults(prev => ({
        ...prev,
        [key]: {
          endpoint: buildUrlFromParameters(endpoint),
          response: null,
          error: `${CLIENT_RATE_LIMITS[endpoint.path].message} (${Math.ceil(remainingTime / 1000)}s remaining)`,
          status: null,
          isLoading: false,
        }
      }));
      return;
    }

    const url = buildUrlFromParameters(endpoint);
    const key = endpoint.path;
    
    // Update client-side rate limit
    setClientRateLimits(prev => ({
      ...prev,
      [endpoint.path]: {
        lastRequest: Date.now(),
        cooldown: CLIENT_RATE_LIMITS[endpoint.path]?.cooldown || 0,
      }
    }));
    
    // Set loading state
    setApiResults(prev => ({
      ...prev,
      [key]: {
        endpoint: url,
        response: null,
        error: null,
        status: null,
        isLoading: true,
      }
    }));

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      setApiResults(prev => ({
        ...prev,
        [key]: {
          endpoint: url,
          response: data,
          error: null,
          status: response.status,
          isLoading: false,
        }
      }));
    } catch (err) {
      setApiResults(prev => ({
        ...prev,
        [key]: {
          endpoint: url,
          response: null,
          error: err instanceof Error ? err.message : 'Failed to fetch',
          status: null,
          isLoading: false,
        }
      }));
    }
  };

  const clearResult = (endpointPath: string) => {
    setApiResults(prev => {
      const newResults = { ...prev };
      delete newResults[endpointPath];
      return newResults;
    });
  };

  const renderParameterInput = (endpoint: ApiEndpoint, param: any, inputId: string) => {
    const value = parameterValues[endpoint.path]?.[param.name] || '';
    const fieldClass =
      'h-9 w-full min-w-0 rounded-md border border-rule bg-paper px-2.5 font-mono text-[13px] text-ink hover:border-ink-2 focus-visible:border-ink';
    
    if (param.type === 'boolean') {
      return (
        <select
          value={value}
          onChange={(e) => updateParameterValue(endpoint.path, param.name, e.target.value)}
          id={inputId}
          className={fieldClass}
        >
          <option value="">Select...</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    
    if (param.enum) {
      return (
        <select
          value={value}
          onChange={(e) => updateParameterValue(endpoint.path, param.name, e.target.value)}
          id={inputId}
          className={fieldClass}
        >
          <option value="">Select...</option>
          {param.enum.map((option: string) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }
    
    return (
      <input
        type={param.type === 'integer' ? 'number' : 'text'}
        value={value}
        onChange={(e) => updateParameterValue(endpoint.path, param.name, e.target.value)}
        placeholder={param.example || ''}
        id={inputId}
          className={fieldClass}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="page pt-10">
        <p className="text-sm text-ink-2" aria-live="polite">
          Loading the API specification…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page pt-10">
        <div role="alert" className="rounded-lg border border-danger px-4 py-3 text-sm">
          <h1 className="font-semibold text-danger">API documentation could not be loaded</h1>
          <p className="mt-1 text-ink">{error}. Reload the page to try again.</p>
        </div>
      </div>
    );
  }

  const codeBlock =
    'overflow-x-auto rounded-lg border border-rule bg-paper px-4 py-3 font-mono text-[13px] text-ink';

  return (
    <div className="page pt-8 sm:pt-10">
      <div className="grid gap-x-12 gap-y-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <h1 className="text-[26px] font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[28px]">
            IPMapAWS REST API
          </h1>
          <p className="mt-3 max-w-[64ch] text-ink-2">
            The same data and lookup as the site, over HTTP: look up which AWS prefix contains an IP
            or CIDR, search and filter the published ranges, export every matching row, or download
            the raw dataset. Free, no authentication, CORS enabled for any origin, described by an{' '}
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline decoration-sage underline-offset-4"
            >
              OpenAPI 3.0 spec
            </a>
            .
          </p>
        </div>
        <dl className="grid min-w-0 grid-cols-1 gap-y-3 border-t border-rule pt-4 text-sm sm:grid-cols-[9rem_1fr] lg:col-span-5 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-1">
          <dt className="text-ink-2">Base URL</dt>
          <dd className="flex min-w-0 items-center gap-3">
            <code className="truncate font-mono text-[13px] text-ink">{baseUrl}</code>
            <button
              type="button"
              onClick={() => copyToClipboard(baseUrl)}
              className="shrink-0 rounded-sm text-[13px] font-semibold text-ink underline decoration-sage underline-offset-4"
            >
              {copiedUrl === baseUrl ? 'Copied' : 'Copy'}
            </button>
          </dd>
          <dt className="text-ink-2">Rate limits, per IP</dt>
          <dd className="text-ink">
            50/hour for the full dataset, 10/minute for lookup and search, 5 per 10 minutes for
            export. Best effort; limits may vary across server instances.
          </dd>
          <dt className="text-ink-2">Source</dt>
          <dd className="text-ink">
            AWS&apos;s{' '}
            <a
              href="https://ip-ranges.amazonaws.com/ip-ranges.json"
              target="_blank"
              rel="noreferrer"
              className="font-mono underline decoration-sage underline-offset-4"
            >
              ip-ranges.json
            </a>
            , read directly and cached for an hour.
          </dd>
        </dl>
      </div>

      <nav aria-label="Endpoints" className="mt-10 border-t border-ink pt-4">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[13px]">
          {API_ENDPOINTS.map((endpoint) => (
            <li key={endpoint.path}>
              <a
                href={`#${endpoint.path.replace(/\//g, '-').replace(/^-/, '')}`}
                className="text-ink underline decoration-sage underline-offset-4 hover:decoration-ink"
              >
                {endpoint.path}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-2">
        {API_ENDPOINTS.map((endpoint) => {
          const result = apiResults[endpoint.path];
          const customUrl = buildUrlFromParameters(endpoint);
          const curlCommand = `curl "${customUrl}"`;
          const { canRequest, remainingTime } = canMakeRequest(endpoint.path);
          const anchor = endpoint.path.replace(/\//g, '-').replace(/^-/, '');

          return (
            <section
              key={endpoint.path}
              id={anchor}
              aria-labelledby={`${anchor}-title`}
              className="scroll-mt-6 border-b border-rule py-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex min-w-0 items-center gap-3">
                  <span className="rounded-sm border border-sage px-1.5 py-0.5 font-mono text-[12px] font-semibold text-sage-ink">
                    {endpoint.method}
                  </span>
                  <code className="break-all font-mono text-[15px] font-semibold text-ink">
                    {endpoint.path}
                  </code>
                </p>
                <p className="font-mono text-[12px] text-ink-2">{endpoint.rateLimit}</p>
              </div>
              <h2 id={`${anchor}-title`} className="mt-3 text-lg font-bold tracking-[-0.01em] text-ink">
                {endpoint.summary}
              </h2>
              <p className="mt-1 max-w-[72ch] text-ink-2">{endpoint.description}</p>

              <div className="mt-6 grid gap-x-12 gap-y-6 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-6">
                  {endpoint.parameters && endpoint.parameters.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-ink">Parameters</h3>
                        <button
                          type="button"
                          onClick={() => resetParameters(endpoint)}
                          className="inline-flex items-center gap-1 rounded-sm text-[13px] text-ink-2 hover:text-ink"
                        >
                          <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Reset to defaults
                        </button>
                      </div>
                      <div className="mt-2 border-t border-rule">
                        {endpoint.parameters.map((param) => {
                          const inputId = `${anchor}-${param.name}`;
                          return (
                            <div
                              key={param.name}
                              className="grid gap-x-4 gap-y-2 border-b border-rule-2 py-3 sm:grid-cols-[minmax(0,1fr)_12rem]"
                            >
                              <div className="min-w-0">
                                <label htmlFor={inputId} className="flex items-baseline gap-2">
                                  <code className="font-mono text-[13px] font-semibold text-ink">
                                    {param.name}
                                  </code>
                                  <span className="text-[12px] text-ink-2">
                                    {param.type}
                                    {param.required ? ', required' : ''}
                                  </span>
                                </label>
                                <p className="mt-0.5 text-[13px] text-ink-2">{param.description}</p>
                              </div>
                              {renderParameterInput(endpoint, param, inputId)}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-ink-2">No parameters.</p>
                  )}
                </div>

                <div className="min-w-0 lg:col-span-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink">Request</h3>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(curlCommand)}
                      className="rounded-sm text-[13px] font-semibold text-ink underline decoration-sage underline-offset-4"
                    >
                      {copiedUrl === curlCommand ? 'Copied' : 'Copy cURL'}
                    </button>
                  </div>
                  <pre className={`mt-2 whitespace-pre-wrap break-all ${codeBlock}`}>{curlCommand}</pre>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <button
                      type="button"
                      onClick={() => testEndpoint(endpoint)}
                      disabled={result?.isLoading || !canRequest}
                      className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-on-ink transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {result?.isLoading ? (
                        <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                      ) : !canRequest ? (
                        <Clock className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <Play className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      )}
                      {result?.isLoading
                        ? 'Sending…'
                        : !canRequest
                          ? `Wait ${Math.ceil(remainingTime / 1000)}s`
                          : 'Send request'}
                    </button>
                    <a
                      href={customUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-ink underline decoration-sage underline-offset-4"
                    >
                      Open in new tab
                      <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  </div>

                  {result && (
                    <div className="mt-4" aria-live="polite">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                          Response
                          {result.status && (
                            <span
                              className={`rounded-sm border px-1.5 font-mono text-[12px] ${
                                result.status < 400
                                  ? 'border-sage text-sage-ink'
                                  : 'border-danger text-danger'
                              }`}
                            >
                              {result.status}
                            </span>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => clearResult(endpoint.path)}
                          className="inline-flex items-center gap-1 rounded-sm text-[13px] text-ink-2 hover:text-ink"
                        >
                          <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
                          Clear
                        </button>
                      </div>
                      {result.error ? (
                        <p role="alert" className="mt-2 rounded-lg border border-danger px-4 py-3 text-sm text-danger">
                          {result.error}
                        </p>
                      ) : (
                        <pre className={`mt-2 max-h-96 ${codeBlock}`}>
                          {JSON.stringify(result.response, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section aria-labelledby="spec-heading" className="mt-10">
        <h2 id="spec-heading" className="text-lg font-bold tracking-[-0.01em] text-ink">
          OpenAPI specification
        </h2>
        <p className="mt-1 text-ink-2">
          The full OpenAPI 3.0 description of these endpoints, for code generators and API clients.
        </p>
        <a
          href="/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-ink px-4 text-sm font-semibold text-ink hover:bg-sage-tint"
        >
          <FileText className="size-4" strokeWidth={1.75} aria-hidden="true" />
          OpenAPI JSON
        </a>
      </section>
    </div>
  );
}
