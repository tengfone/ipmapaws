import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchableMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  className,
  disabled = false,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleRemoveSelected = (option: string) => {
    onChange(selected.filter(item => item !== option));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const displayText = selected.length === 0 
    ? placeholder 
    : `${selected.length} selected`;

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Main trigger button */}
      <button
        type="button"
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={cn(
          'truncate',
          selected.length === 0 && 'text-muted-foreground'
        )}>
          {displayText}
        </span>
        <ChevronDown 
          className={cn(
            'h-4 w-4 shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {/* Selected items display */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemoveSelected(item)}
                className="hover:text-primary/80"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selected.length > 1 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full z-50 w-full mt-1 rounded-md border bg-popover shadow-md">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2 py-1 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <div className="p-1">
                {filteredOptions.map((option) => {
                  const isSelected = selected.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className={cn(
                        'w-full flex items-center px-2 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground',
                        isSelected && 'bg-accent text-accent-foreground'
                      )}
                      onClick={() => handleToggleOption(option)}
                    >
                      <div className={cn(
                        'mr-2 h-4 w-4 border border-primary rounded-sm flex items-center justify-center',
                        isSelected && 'bg-primary border-primary'
                      )}>
                        {isSelected && (
                          <div className="h-2 w-2 bg-primary-foreground rounded-sm" />
                        )}
                      </div>
                      <span className="truncate">{option}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchTerm ? 'No options found' : 'No options available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 