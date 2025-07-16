'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, Globe, Shield, Zap, ExternalLink, Copy, CheckCircle, Play, X, Loader2, RotateCcw, Clock } from 'lucide-react';

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
  const [spec, setSpec] = useState(null);
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
      .catch((err) => {
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

  const renderParameterInput = (endpoint: ApiEndpoint, param: any) => {
    const value = parameterValues[endpoint.path]?.[param.name] || '';
    
    if (param.type === 'boolean') {
      return (
        <select
          value={value}
          onChange={(e) => updateParameterValue(endpoint.path, param.name, e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
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
          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
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
        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
      />
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-destructive mb-2">
            Error Loading API Documentation
          </h1>
          <p className="text-sm text-destructive/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to App</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">IPMapAWS API Documentation</h1>
              <p className="text-muted-foreground">
                Comprehensive API for accessing AWS IP ranges with search, filtering, and export capabilities
              </p>
            </div>
          </div>

          {/* Quick Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Public API</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Free public access to AWS IP ranges data with comprehensive filtering and search capabilities.
              </p>
            </div>
            
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Rate Limited</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                50 requests/hour for general API, 10/min for search, 5/10min for exports to ensure fair usage.
              </p>
            </div>
            
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold">Real-time Data</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Always up-to-date AWS IP ranges sourced directly from Amazon's official endpoint.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Base URL Info */}
      <div className="container mx-auto px-4 py-4">
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-2">Base URL</h2>
          <div className="flex items-center space-x-2">
            <code className="text-sm bg-card px-2 py-1 rounded border flex-1">
              {baseUrl}
            </code>
            <button
              onClick={() => copyToClipboard(baseUrl)}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title="Copy base URL"
            >
              {copiedUrl === baseUrl ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="container mx-auto px-4 pb-8">
        <div className="space-y-6">
          {API_ENDPOINTS.map((endpoint, index) => {
            const result = apiResults[endpoint.path];
            const customUrl = buildUrlFromParameters(endpoint);
            const curlCommand = `curl "${customUrl}"`;
            const { canRequest, remainingTime } = canMakeRequest(endpoint.path);
            
            return (
              <div key={index} className="bg-card border rounded-lg overflow-hidden">
                {/* Endpoint Header */}
                <div className="border-b p-6 bg-muted/30">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded text-xs font-mono font-medium ${
                        endpoint.method === 'GET' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono">{endpoint.path}</code>
                    </div>
                    <div className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                      {endpoint.rateLimit}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{endpoint.summary}</h3>
                  <p className="text-muted-foreground">{endpoint.description}</p>
                </div>

                {/* Parameters */}
                {endpoint.parameters && endpoint.parameters.length > 0 && (
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold">Parameters</h4>
                      <button
                        onClick={() => resetParameters(endpoint)}
                        className="inline-flex items-center space-x-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        title="Reset to defaults"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Reset</span>
                      </button>
                    </div>
                    <div className="space-y-4">
                      {endpoint.parameters.map((param, paramIndex) => (
                        <div key={paramIndex} className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 bg-muted/20 rounded-lg">
                          <div className="lg:col-span-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <code className="text-sm font-mono text-primary">{param.name}</code>
                              {param.required && <span className="text-red-500">*</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">{param.type}</div>
                          </div>
                          <div className="lg:col-span-2">
                            <div className="text-sm mb-2">{param.description}</div>
                            {param.example && (
                              <div className="text-xs text-muted-foreground">
                                Default: <code className="bg-muted px-1 rounded">{param.example}</code>
                              </div>
                            )}
                          </div>
                          <div className="lg:col-span-2">
                            {renderParameterInput(endpoint, param)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Example Request & Try It */}
                <div className="p-6">
                  <h4 className="font-semibold mb-4">Test Request</h4>
                  
                  {/* cURL Command */}
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-500"># cURL</span>
                      <button
                        onClick={() => copyToClipboard(curlCommand)}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Copy cURL command"
                      >
                        {copiedUrl === curlCommand ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="break-all">{curlCommand}</div>
                  </div>

                  {/* Try It Button */}
                  <div className="flex items-center space-x-4 mb-4">
                    <button
                      onClick={() => testEndpoint(endpoint)}
                      disabled={result?.isLoading || !canRequest}
                      className={`inline-flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                        !canRequest 
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : result?.isLoading
                          ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {result?.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : !canRequest ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span>
                        {result?.isLoading 
                          ? 'Testing...' 
                          : !canRequest 
                          ? `Wait ${Math.ceil(remainingTime / 1000)}s`
                          : 'Try this endpoint'
                        }
                      </span>
                    </button>
                    
                    <a
                      href={customUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-primary hover:underline"
                    >
                      <span>Open in new tab</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>

                    {!canRequest && (
                      <div className="text-sm text-muted-foreground">
                        Rate limited - please wait before testing again
                      </div>
                    )}
                  </div>

                  {/* API Result Display */}
                  {result && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">Response</span>
                          {result.status && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              result.status < 400 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {result.status}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => clearResult(endpoint.path)}
                          className="text-muted-foreground hover:text-foreground p-1"
                          title="Clear result"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="p-4 bg-gray-900 text-green-400 font-mono text-sm max-h-96 overflow-auto">
                        {result.error ? (
                          <div className="text-red-400">Error: {result.error}</div>
                        ) : (
                          <pre>{JSON.stringify(result.response, null, 2)}</pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* JSON Spec Download */}
        <div className="mt-8 bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">OpenAPI Specification</h3>
          <p className="text-muted-foreground mb-4">
            Download the complete OpenAPI 3.0 specification for this API in JSON format.
          </p>
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span>Download OpenAPI JSON</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              IPMapAWS API is free and open source. Data sourced from{' '}
              <a
                href="https://ip-ranges.amazonaws.com/ip-ranges.json"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
              >
                AWS IP ranges
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 