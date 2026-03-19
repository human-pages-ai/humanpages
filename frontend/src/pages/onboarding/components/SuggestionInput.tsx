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
  const [inputText, setInputText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<{ value: string; label: string }[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve the display label for the current value
  const selectedLabel = suggestions.find(s => s.value === value)?.label || value;

  // What to show in the input: user's typed text while editing, otherwise the resolved label
  const displayValue = isEditing ? inputText : selectedLabel;

  // Filter suggestions based on typed text
  useEffect(() => {
    if (!isOpen) {
      setFilteredSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    const searchText = isEditing ? inputText.toLowerCase() : '';
    const filtered = searchText
      ? suggestions.filter(
          s => s.label.toLowerCase().includes(searchText) || s.value.toLowerCase().includes(searchText)
        )
      : suggestions; // Show all when just opened
    setFilteredSuggestions(filtered);
    setHighlightedIndex(-1);
  }, [inputText, isOpen, suggestions, isEditing]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: { value: string; label: string }) => {
    onChange(suggestion.value);
    setInputText('');
    setIsEditing(false);
    setIsOpen(false);
    // Don't re-focus — it triggers handleFocus which re-opens the dropdown
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    setIsEditing(true);
    setIsOpen(true);

    // If user is typing freely (no match selected), pass raw text as value
    // This allows free-text entry for currency codes etc.
    const exactMatch = suggestions.find(
      s => s.label.toLowerCase() === text.toLowerCase() || s.value.toLowerCase() === text.toLowerCase()
    );
    if (exactMatch) {
      onChange(exactMatch.value);
    } else {
      onChange(text);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    // Start editing with empty text to show all suggestions
    if (value) {
      setInputText('');
      setIsEditing(false);
    }
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
        setIsEditing(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${value ? 'pr-8' : ''} ${className}`}
      />

      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); setInputText(''); setIsEditing(false); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
          aria-label="Clear selection"
        >
          ×
        </button>
      )}

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
                    : suggestion.value === value
                    ? 'bg-orange-25 text-slate-900 font-medium'
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
