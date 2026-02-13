'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Article } from '../types';
import { TagInput } from './TagInput';
import { getTagColor } from '../lib/tag-utils';

interface ArticleTagEditorProps {
  article: Article;
}

export function ArticleTagEditor({ article }: ArticleTagEditorProps) {
  const queryClient = useQueryClient();
  const [localTags, setLocalTags] = useState<string[]>(article.tags || []);

  const {
    data: allTagsSuggestions = [],
  } = useQuery<string[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      const data = await response.json();
      return data.tags;
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const response = await fetch(`/api/articles/${article.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      if (!response.ok) {
        throw new Error('Failed to update tags');
      }
      return tags;
    },
    onSuccess: (tags) => {
      queryClient.setQueryData<Article>(['article', article.id], (prev) =>
        prev ? { ...prev, tags } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  // Debounce tag updates
  useEffect(() => {
    const currentTags = article.tags || [];
    const tagsChanged =
      localTags.length !== currentTags.length ||
      localTags.some((tag, i) => tag !== currentTags[i]);

    if (!tagsChanged) return;

    const timeoutId = setTimeout(() => {
      updateTagsMutation.mutate(localTags);
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [localTags, article.tags, article.id, updateTagsMutation]);

  const handleTagsChange = (newTags: string[]) => {
    setLocalTags(newTags);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Tags</h3>
        <TagInput
          tags={localTags}
          suggestions={allTagsSuggestions}
          onChange={handleTagsChange}
          placeholder="Add tags to organize..."
        />
        <p className="text-xs text-gray-500 mt-2">
          {updateTagsMutation.isPending && 'Saving tags...'}
          {!updateTagsMutation.isPending && localTags.length > 0 && 'Tags saved'}
        </p>
      </div>

      {localTags.length > 0 && (
        <div className="border-t border-gray-800 pt-4">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Current tags</h4>
          <div className="flex flex-wrap gap-2">
            {localTags.map((tag) => (
              <div
                key={tag}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getTagColor(tag)}`}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
