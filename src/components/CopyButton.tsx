'use client';

import React, { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  /** Text placed on the clipboard, or a function that builds it at click time. */
  value: string | (() => string);
  /** Visible label before copying, e.g. "Copy prefix". */
  label?: string;
  /** What is being copied, for the accessible name, e.g. "3.5.140.0/22". */
  subject?: string;
  variant?: 'button' | 'text';
  className?: string;
}

/** Copies on click and stamps "Copied" in place for two seconds. */
export function CopyButton({
  value,
  label = 'Copy',
  subject,
  variant = 'text',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = async () => {
    if (!(await copyToClipboard(typeof value === 'function' ? value() : value)))
      return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const name = subject ? `${copied ? 'Copied' : label} ${subject}` : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={name}
      className={cn(
        variant === 'button'
          ? 'inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-3 text-[13px] font-semibold transition-colors'
          : 'shrink-0 whitespace-nowrap rounded-sm text-[13px] font-semibold underline underline-offset-4 transition-colors',
        variant === 'button' &&
          (copied
            ? 'border-sage-ink text-sage-ink'
            : 'border-ink text-ink hover:bg-sage-tint'),
        variant === 'text' &&
          (copied
            ? 'text-sage-ink no-underline'
            : 'text-ink decoration-sage hover:decoration-ink'),
        className
      )}
    >
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}
