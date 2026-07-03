'use client';

import { Loader2, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getLocalArticles } from '../lib/local-library';
import type { SearchResult } from '../types';
import { useAuth } from './AuthProvider';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isLocalMode = !authLoading && !user;
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (normalizedQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      if (isLocalMode) {
        const articles = await getLocalArticles();
        const matches = articles
          .filter((article) => {
            const haystack = `${article.title} ${article.url} ${article.byline ?? ''} ${
              article.category ?? ''
            } ${article.content.replace(/<[^>]*>/g, ' ')}`.toLowerCase();
            return haystack.includes(normalizedQuery);
          })
          .slice(0, 12)
          .map<SearchResult>((article) => ({
            id: article.id,
            url: article.url,
            title: article.title,
            byline: article.byline,
            status: article.status,
            notesCount: article.notesCount ?? article.notes?.length ?? 0,
            createdAt: article.createdAt,
            updatedAt: article.updatedAt,
            matchedFields: ['local'],
            snippets: [
              {
                field: 'title',
                text: article.title,
              },
            ],
            relevanceScore: 1,
            listIds: article.listIds,
            category: article.category,
          }));

        setResults(matches);
        setIsOpen(true);
        setSelectedIndex(-1);
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
    },
    [isLocalMode]
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setIsOpen(false);
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
      // Memory captures have no per-item reader route; send them to the
      // memory surface so the user can retrieve the full capture there.
      navigate(result.kind === 'memory' ? '/memory' : `/reader/${result.id}`);
    },
    [navigate]
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
            handleResultClick(results[selectedIndex]);
          } else if (results.length > 0) {
            handleResultClick(results[0]);
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
          placeholder={isLocalMode ? 'Find saved sources...' : 'Find articles, notes, and chats...'}
          className="border-[var(--gray-6)] bg-[var(--gray-2)] pr-10 pl-10 text-[var(--gray-12)] placeholder:text-[var(--gray-10)] focus:border-[var(--accent-8)]"
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
        <div className="absolute top-full z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-md border border-[var(--gray-6)] bg-[var(--gray-2)] shadow-2xl">
          {results.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <p className="text-sm">No results found for &quot;{query}&quot;</p>
              <p className="mt-1 text-xs">Try different keywords</p>
            </div>
          ) : (
            <div className="py-2">
              <div className="flex items-center justify-between border-b border-[var(--gray-5)] px-4 py-2 text-xs text-gray-500">
                <span>
                  {results.length} {results.length === 1 ? 'result' : 'results'}
                </span>
                <span className="text-gray-600">Use ↑↓ to navigate, Enter to open</span>
              </div>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className={`w-full border-b border-[var(--gray-5)] px-4 py-3 text-left transition-colors last:border-b-0 ${
                    selectedIndex === index ? 'bg-[var(--gray-4)]' : 'hover:bg-[var(--gray-3)]'
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
