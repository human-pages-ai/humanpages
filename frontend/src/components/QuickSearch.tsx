import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';

interface SearchResult {
  id: string;
  displayName?: string;
  username?: string;
  skills: string[];
  profilePhotoUrl?: string;
  isAvailable: boolean;
  reputation?: {
    avgRating: number;
    reviewCount: number;
  };
}

const SKILL_SUGGESTIONS = [
  'Translation',
  'Data Labeling',
  'Content Writing',
  'Design',
  'QA Testing',
  'Customer Support',
  'Social Media',
  'Research',
  'Video Editing',
  'Photography',
];

export default function QuickSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowSuggestions(true);
      return;
    }

    setLoading(true);
    try {
      analytics.track('quicksearch_search', { query: searchQuery });

      // Use the listings API as a temporary proxy for human search
      await api.getListings({
        skill: searchQuery,
        limit: 3,
      });

      // Transform to human cards (would be actual human search in production)
      setResults([]);
      setShowSuggestions(true);
    } catch (error) {
      setResults([]);
      setShowSuggestions(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    handleSearch(value);
  };

  const handleSuggestionClick = (skill: string) => {
    analytics.track('quicksearch_suggestion_clicked', { skill });
    setQuery(skill);
    handleSearch(skill);
  };

  const handleViewAll = () => {
    analytics.track('quicksearch_view_all_clicked', { query });
    navigate('/listings?skill=' + encodeURIComponent(query));
  };

  const handleQuickHire = () => {
    analytics.track('quicksearch_quick_hire_clicked');
    navigate('/quick-hire');
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center px-4 py-3">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Find a freelancer... (e.g., translation, design)"
            className="flex-1 ml-3 outline-none text-gray-700 placeholder-gray-400"
          />
          {loading && (
            <div className="animate-spin">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          )}
        </div>

        {/* Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 bg-white border border-t-0 border-gray-200 rounded-b-lg shadow-lg z-10">
            {/* Search results */}
            {results.length > 0 && (
              <>
                <div className="border-b border-gray-200">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => navigate(`/humans/${result.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                    >
                      {result.profilePhotoUrl && (
                        <img
                          src={result.profilePhotoUrl}
                          alt={result.displayName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {result.displayName || result.username || 'Unnamed'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.skills.slice(0, 2).join(', ')}
                        </div>
                      </div>
                      {result.reputation && (
                        <div className="text-xs text-gray-600">
                          ★ {result.reputation.avgRating.toFixed(1)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleViewAll}
                  className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium"
                >
                  View all results
                </button>
              </>
            )}

            {/* Skill suggestions when empty or no results */}
            {results.length === 0 && (
              <>
                {query && (
                  <button
                    onClick={handleViewAll}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-900 border-b border-gray-100 font-medium"
                  >
                    Search for "{query}"
                  </button>
                )}
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-600 font-semibold mb-2">Popular skills:</p>
                  <div className="flex flex-wrap gap-2">
                    {SKILL_SUGGESTIONS.map((skill) => (
                      <button
                        key={skill}
                        onClick={() => handleSuggestionClick(skill)}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Quick hire CTA */}
            <button
              onClick={handleQuickHire}
              className="w-full text-left px-4 py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 border-t border-gray-200 font-medium text-sm"
            >
              + Quick Hire (3 steps)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
