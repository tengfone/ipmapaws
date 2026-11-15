import { SortDirection, SortField } from '@/types';

/**
 * Lookup and register state as URL query parameters, so a view can be shared:
 *
 *   ?ip=3.5.140.2&q=s3&regions=us-east-1,eu-west-1&services=S3&v=4&sort=-region&page=2
 *
 * Defaults are omitted, so an untouched page has a clean URL.
 */

export interface ViewParams {
  /** Single lookup query. */
  ip: string | null;
  /** Register free-text search. */
  q: string;
  regions: string[];
  services: string[];
  v4: boolean;
  v6: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  page: number;
}

export const DEFAULT_VIEW: ViewParams = {
  ip: null,
  q: '',
  regions: [],
  services: [],
  v4: true,
  v6: true,
  sortField: 'prefix',
  sortDirection: 'asc',
  page: 1,
};

const SORT_FIELDS: SortField[] = [
  'prefix',
  'region',
  'service',
  'network_border_group',
];
const SORT_ALIASES: Record<string, SortField> = {
  prefix: 'prefix',
  region: 'region',
  service: 'service',
  group: 'network_border_group',
  network_border_group: 'network_border_group',
};
const MAX_VALUE_LENGTH = 256;
const MAX_LIST = 100;

function list(value: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s.length <= 64)
    )
  ).slice(0, MAX_LIST);
}

/** Reads view state from a query string; anything malformed falls back to its default. */
export function parseViewParams(search: string): ViewParams {
  const params = new URLSearchParams(search);
  const ip = params.get('ip')?.trim().slice(0, MAX_VALUE_LENGTH) || null;
  const q = params.get('q')?.slice(0, MAX_VALUE_LENGTH) ?? '';

  const v = params.get('v');
  let v4 = true;
  let v6 = true;
  if (v !== null) {
    const versions = v.split(',');
    v4 = versions.includes('4');
    v6 = versions.includes('6');
    if (v === 'none') {
      v4 = false;
      v6 = false;
    } else if (!v4 && !v6) {
      v4 = true;
      v6 = true;
    }
  }

  let sortField: SortField = 'prefix';
  let sortDirection: SortDirection = 'asc';
  const sort = params.get('sort');
  if (sort) {
    const desc = sort.startsWith('-');
    const field = SORT_ALIASES[desc ? sort.slice(1) : sort];
    if (field) {
      sortField = field;
      sortDirection = desc ? 'desc' : 'asc';
    }
  }

  const pageNumber = Number(params.get('page'));
  const page =
    Number.isInteger(pageNumber) && pageNumber > 1
      ? Math.min(pageNumber, 100000)
      : 1;

  return {
    ip,
    q,
    regions: list(params.get('regions')),
    services: list(params.get('services')),
    v4,
    v6,
    sortField,
    sortDirection,
    page,
  };
}

/** Writes view state as a query string (no leading "?"), omitting defaults. */
export function serializeViewParams(view: ViewParams): string {
  const parts: string[] = [];
  const add = (key: string, value: string) => {
    // Keep commas, colons and slashes readable; encode everything else.
    const encoded = encodeURIComponent(value)
      .replace(/%2C/gi, ',')
      .replace(/%3A/gi, ':')
      .replace(/%2F/gi, '/');
    parts.push(`${key}=${encoded}`);
  };
  if (view.ip) add('ip', view.ip);
  if (view.q) add('q', view.q);
  if (view.regions.length) add('regions', view.regions.join(','));
  if (view.services.length) add('services', view.services.join(','));
  if (!(view.v4 && view.v6)) {
    add('v', view.v4 ? '4' : view.v6 ? '6' : 'none');
  }
  if (view.sortField !== 'prefix' || view.sortDirection !== 'asc') {
    const name =
      view.sortField === 'network_border_group' ? 'group' : view.sortField;
    add('sort', `${view.sortDirection === 'desc' ? '-' : ''}${name}`);
  }
  if (view.page > 1) add('page', String(view.page));
  return parts.join('&');
}

export function isSortField(value: string): value is SortField {
  return (SORT_FIELDS as string[]).includes(value);
}
