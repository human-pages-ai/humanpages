import { useState, useRef, useEffect } from 'react';

export interface SuggestionInputProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function SuggestionInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className = '',
  onKeyDown,
}: SuggestionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<{ value: string; label: string }[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the label for the current value
  const currentLabel = suggestions.find(s => s.value === value)?.label || value;

  // Filter suggestions based on input
  useEffect(() => {
    if (!isOpen) {
      setFilteredSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    const lowerValue = value.toLowerCase();
    const filtered = suggestions.filter(
      s => s.label.toLowerCase().includes(lowerValue) || s.value.toLowerCase().includes(lowerValue)
    );
    setFilteredSuggestions(filtered);
    setHighlightedIndex(-1);
  }, [value, isOpen, suggestions]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: { value: string; label: string }) => {
    onChange(suggestion.value);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i =>
          i < filteredSuggestions.length - 1 ? i + 1 : i
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => (i > 0 ? i - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(filteredSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={currentLabel}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${className}`}
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10">
          <div className="max-h-60 overflow-y-auto">
            {filteredSuggestions.map((suggestion, idx) => (
              <button
                key={suggestion.value}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={`w-full text-left px-3 py-2.5 sm:py-2 text-base sm:text-sm transition-colors ${
                  idx === highlightedIndex
                    ? 'bg-orange-50 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
