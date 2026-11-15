import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchableMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Accessible name, e.g. "Regions". */
  label: string;
  /** Trigger text when nothing is selected, e.g. "All regions (43)". */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Show chips in the sage region-label style. */
  chipStyle?: 'region' | 'plain';
  className?: string;
  disabled?: boolean;
}

export function SearchableMultiSelect({
  options,
  selected,
  onChange,
  label,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  chipStyle = 'plain',
  className,
  disabled = false,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const close = (returnFocus: boolean) => {
    setIsOpen(false);
    setSearchTerm('');
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handlePointer);
    searchInputRef.current?.focus();
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [isOpen]);

  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option]
    );
  };

  const triggerText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <div
      className={cn('relative min-w-0', className)}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${selected.length === 0 ? placeholder : triggerText}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-rule bg-paper px-3 text-left text-sm text-ink transition-colors hover:border-ink-2',
          isOpen && 'border-ink',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        onClick={() => !disabled && (isOpen ? close(false) : setIsOpen(true))}
        disabled={disabled}
      >
        <span
          className={cn(
            'truncate',
            selected.length === 1 && 'font-mono text-[13px]'
          )}
        >
          {triggerText}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-ink-2 transition-transform',
            isOpen && 'rotate-180'
          )}
          strokeWidth={1.75}
        />
      </button>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {selected.map((item) => (
            <span
              key={item}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border py-0.5 pl-2 pr-1 font-mono text-[12px] text-ink',
                chipStyle === 'region'
                  ? 'border-sage bg-sage-tint'
                  : 'border-rule bg-paper'
              )}
            >
              {item}
              <button
                type="button"
                onClick={() => toggleOption(item)}
                aria-label={`Remove ${item}`}
                className="rounded-sm p-0.5 text-ink-2 hover:text-ink"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            </span>
          ))}
          {selected.length > 1 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[12px] text-ink-2 underline decoration-sage underline-offset-4 hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div
          id={listId}
          className="absolute left-0 top-11 z-40 w-full min-w-56 rounded-md border border-ink bg-paper shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]"
        >
          <div className="relative border-b border-rule">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-2"
              strokeWidth={1.75}
            />
            <input
              ref={searchInputRef}
              type="text"
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full bg-transparent pl-8 pr-2 text-sm text-ink outline-none"
            />
          </div>

          <div
            className="max-h-64 overflow-y-auto p-1"
            role="group"
            aria-label={label}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={isSelected}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-mono text-[13px] text-ink hover:bg-sage-tint',
                      isSelected && 'bg-sage-tint'
                    )}
                    onClick={() => toggleOption(option)}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'border-sage-ink bg-sage-ink text-on-ink'
                          : 'border-ink-2'
                      )}
                    >
                      {isSelected && (
                        <Check className="size-3" strokeWidth={3} />
                      )}
                    </span>
                    <span className="truncate">{option}</span>
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-4 text-center text-sm text-ink-2">
                {searchTerm ? `Nothing matches "${searchTerm}"` : 'No options'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
