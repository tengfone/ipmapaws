'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  parseViewParams,
  serializeViewParams,
  ViewParams,
} from '@/lib/url-state';

/*
 * The URL is the store for shareable view state. Components read it with
 * useViewParams() and write it with updateViewParams(); writes use
 * history.replaceState, so typing and paging never add history entries.
 * The server render sees no query string, and the client picks the real one
 * up right after hydration (useSyncExternalStore handles the switch).
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

const getSnapshot = () => window.location.search;
const getServerSnapshot = () => '';

/** Merges `patch` into the current URL's view state and replaces the URL. */
export function updateViewParams(patch: Partial<ViewParams>) {
  const current = parseViewParams(window.location.search);
  const query = serializeViewParams({ ...current, ...patch });
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  if (
    url !==
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  ) {
    window.history.replaceState(window.history.state, '', url);
  }
  listeners.forEach((listener) => listener());
}

/** A full link to the current page with the given view state. */
export function viewUrl(view: ViewParams): string {
  const query = serializeViewParams(view);
  return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;
}

export function useViewParams(): [
  ViewParams,
  (patch: Partial<ViewParams>) => void,
] {
  const search = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const params = useMemo(() => parseViewParams(search), [search]);
  const update = useCallback(
    (patch: Partial<ViewParams>) => updateViewParams(patch),
    []
  );
  return [params, update];
}
