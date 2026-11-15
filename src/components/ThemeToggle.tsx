'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains('dark');

/**
 * Light/dark switch. The first paint is decided by the inline script in the
 * root layout (saved choice, else the system setting); this flips it and
 * remembers the choice.
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  const toggle = () => {
    const next = !isDark();
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.theme = next ? 'dark' : 'light';
    } catch {
      // Private mode: the switch still works for this page view.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className="inline-flex size-9 items-center justify-center rounded-md border border-rule text-ink transition-colors hover:border-ink hover:bg-paper"
    >
      {dark ? (
        <Sun className="size-4" strokeWidth={1.75} />
      ) : (
        <Moon className="size-4" strokeWidth={1.75} />
      )}
    </button>
  );
}
