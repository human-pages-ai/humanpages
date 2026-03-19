import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

export interface ComboboxOption {
  label: string;
  value: string;
  secondary?: string;
}

type OptionsInput = string[] | ComboboxOption[] | (() => Promise<string[] | ComboboxOption[]>);

/** Normalize mixed options to ComboboxOption[] */
function normalizeOptions(raw: string[] | ComboboxOption[]): ComboboxOption[] {
  if (raw.length === 0) return [];
  if (typeof raw[0] === 'string') {
    return (raw as string[]).map(s => ({ label: s, value: s }));
  }
  return raw as ComboboxOption[];
}

interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: OptionsInput;
  placeholder?: string;
  required?: boolean;
  allowFreeText?: boolean;
  id?: string;
  label?: string;
  className?: string;
}

export default function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = '',
  required = false,
  allowFreeText = true,
  id,
  label,
  className = '',
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loadedOptions, setLoadedOptions] = useState<ComboboxOption[] | null>(
    Array.isArray(options) ? normalizeOptions(options) : null
  );
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Re-normalize when options array reference changes
  const normalizedSyncOptions = useMemo(() => {
    if (Array.isArray(options)) {
      return normalizeOptions(options);
    }
    return null;
  }, [options]);

  // Load async options on first focus
  const loadAsyncOptions = useCallback(async () => {
    if (!Array.isArray(options) && !loadedOptions) {
      setLoading(true);
      try {
        const result = await options();
        setLoadedOptions(normalizeOptions(result));
      } catch (error) {
        console.error('Failed to load options:', error);
        setLoadedOptions([]);
      } finally {
        setLoading(false);
      }
    }
  }, [options, loadedOptions]);

  // Get current options list
  const getCurrentOptions = useCallback((): ComboboxOption[] => {
    if (normalizedSyncOptions) {
      return normalizedSyncOptions;
    }
    return loadedOptions || [];
  }, [normalizedSyncOptions, loadedOptions]);

  // Filter options based on search text
  const getFilteredOptions = useCallback((): ComboboxOption[] => {
    const currentOptions = getCurrentOptions();
    if (!search.trim()) {
      return currentOptions.slice(0, 15);
    }

    const searchLower = search.toLowerCase();
    const prefixMatches: ComboboxOption[] = [];
    const substringMatches: ComboboxOption[] = [];

    for (const option of currentOptions) {
      const labelLower = option.label.toLowerCase();
      if (labelLower.startsWith(searchLower)) {
        prefixMatches.push(option);
      } else if (labelLower.includes(searchLower)) {
        substringMatches.push(option);
      }
      // Early exit once we have enough matches
      if (prefixMatches.length + substringMatches.length >= 15) break;
    }

    return [...prefixMatches, ...substringMatches].slice(0, 15);
  }, [search, getCurrentOptions]);

  const filteredOptions = getFilteredOptions();

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (open) {
          // If allowFreeText and search is non-empty, accept it as value
          if (allowFreeText && search.trim() && search !== value) {
            onChange(search);
          } else if (!allowFreeText) {
            // Revert search to current value
            setSearch(value);
          }
          setOpen(false);
          setHighlightIndex(-1);
        }
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [open, search, value, onChange, allowFreeText]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
      const optionElement = optionRefs.current.get(highlightIndex);
      if (optionElement) {
        optionElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, filteredOptions.length]);

  // Update search when value prop changes externally
  useEffect(() => {
    if (!open) {
      setSearch(value);
    }
  }, [value, open]);

  const handleFocus = () => {
    setOpen(true);
    setSearch(value);
    setHighlightIndex(-1);
    loadAsyncOptions();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    setHighlightIndex(-1);
  };

  const handleOptionClick = (option: ComboboxOption) => {
    onChange(option.value);
    setOpen(false);
    setSearch(option.value);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex =
          highlightIndex < filteredOptions.length - 1
            ? highlightIndex + 1
            : 0;
        setHighlightIndex(nextIndex);
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex =
          highlightIndex <= 0
            ? filteredOptions.length - 1
            : highlightIndex - 1;
        setHighlightIndex(prevIndex);
        break;
      }

      case 'Enter': {
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
          // Select highlighted option
          handleOptionClick(filteredOptions[highlightIndex]);
        } else if (allowFreeText && search.trim()) {
          // Accept search text as value
          onChange(search);
          setOpen(false);
          setHighlightIndex(-1);
        }
        break;
      }

      case 'Escape': {
        e.preventDefault();
        setOpen(false);
        setSearch(value);
        setHighlightIndex(-1);
        break;
      }

      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={id}>
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] bg-white"
        />

        {/* Chevron indicator */}
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          {loading ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              Loading options...
            </div>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightIndex;

              return (
                <div
                  key={`${option.value}-${index}`}
                  ref={(el) => {
                    if (el) {
                      optionRefs.current.set(index, el);
                    }
                  }}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleOptionClick(option)}
                  className={`w-full text-left px-3 py-2.5 text-sm cursor-pointer min-h-[44px] flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : isHighlighted
                        ? 'bg-gray-100 text-gray-900'
                        : 'hover:bg-blue-50 text-gray-700'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {option.secondary && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{option.secondary}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-3 text-sm text-gray-400 italic">
              {allowFreeText
                ? 'No matches — press Enter to use custom value'
                : 'No matching options'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
