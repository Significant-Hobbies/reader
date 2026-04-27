'use client';

import { Loader2, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SearchResult } from '../types';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleResultClick = useCallback(
    (articleId: string) => {
      setIsOpen(false);
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
      router.push(`/reader/${articleId}`);
    },
    [router]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (!isOpen || results.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          event.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            handleResultClick(results[selectedIndex].id);
          } else if (results.length > 0) {
            handleResultClick(results[0].id);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, handleResultClick]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const renderSnippet = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
      <span>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <mark key={i} className="rounded bg-yellow-300 px-0.5 text-gray-900">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'title':
        return 'Title';
      case 'content':
        return 'Content';
      case 'notes':
        return 'Notes';
      case 'aiChat':
        return 'AI Chat';
      default:
        return field;
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles, notes, and chats..."
          className="border-gray-700 bg-gray-900 pr-10 pl-10 text-white placeholder-gray-400 focus:border-blue-500"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-white"
            aria-label="Clear search"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        )}
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
          {results.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <p className="text-sm">No results found for &quot;{query}&quot;</p>
              <p className="mt-1 text-xs">Try different keywords</p>
            </div>
          ) : (
            <div className="py-2">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2 text-xs text-gray-500">
                <span>
                  {results.length} {results.length === 1 ? 'result' : 'results'}
                </span>
                <span className="text-gray-600">Use ↑↓ to navigate, Enter to open</span>
              </div>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result.id)}
                  className={`w-full border-b border-gray-800 px-4 py-3 text-left transition-colors last:border-b-0 ${
                    selectedIndex === index ? 'bg-gray-800' : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-1 line-clamp-1 text-sm font-medium text-white">
                        {renderSnippet(
                          result.snippets.find((s) => s.field === 'title')?.text || result.title
                        )}
                      </h3>
                      <p className="mb-2 truncate text-xs text-gray-500">{result.url}</p>
                      {result.snippets
                        .filter((s) => s.field !== 'title')
                        .slice(0, 2)
                        .map((snippet, idx) => (
                          <div key={idx} className="mt-1">
                            <Badge variant="secondary" className="mb-1 text-xs">
                              {getFieldLabel(snippet.field)}
                            </Badge>
                            <p className="line-clamp-2 text-xs text-gray-400">
                              {renderSnippet(snippet.text)}
                            </p>
                          </div>
                        ))}
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="default" className="text-xs">
                          {result.notesCount} notes
                        </Badge>
                        {result.matchedFields.length > 0 && (
                          <span className="text-xs text-gray-500">
                            Matched: {result.matchedFields.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
