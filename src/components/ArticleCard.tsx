'use client';

import {
  BookOpen,
  Clock,
  ExternalLink,
  FileText,
  Heart,
  type LucideIcon,
  MoreVertical,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';

import { formatReadingTime } from '../lib/reading-time-utils';
import { getTagColor } from '../lib/tag-utils';
import { formatDate } from '../lib/utils';
import type { ArticleStatus, ArticleSummary, List } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

function getArticleKind(article: ArticleSummary): {
  label: string;
  description: string;
  icon: LucideIcon;
  primaryAction: string;
} {
  if (article.type === 'link') {
    return {
      label: 'Link',
      description: 'Read outside',
      icon: ExternalLink,
      primaryAction: 'Open original',
    };
  }
  if (article.type === 'pdf') {
    return {
      label: 'PDF',
      description: 'Imported document',
      icon: FileText,
      primaryAction: 'Read PDF',
    };
  }
  return {
    label: 'Article',
    description: 'Imported article',
    icon: BookOpen,
    primaryAction: 'Read in Reader',
  };
}

function getArticleOrigin(article: ArticleSummary) {
  if (article.type === 'pdf') return 'Stored PDF';

  try {
    return new URL(article.url).hostname.replace(/^www\./, '');
  } catch {
    return article.url;
  }
}

function formatFileSize(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function getContextLine(article: ArticleSummary) {
  if (article.type === 'link') {
    return `Outside link saved from ${getArticleOrigin(article)}`;
  }
  if (article.type === 'pdf') {
    const details = [
      article.pdfMetadata?.pageCount ? `${article.pdfMetadata.pageCount} pages` : null,
      formatFileSize(article.pdfMetadata?.fileSize),
    ].filter(Boolean);
    return details.length > 0 ? `Research PDF · ${details.join(' · ')}` : 'Research PDF';
  }
  return article.readingTimeMinutes
    ? `Reader article · ${formatReadingTime(article.readingTimeMinutes)}`
    : 'Reader article';
}

function ListIcon({ icon }: { icon: List['icon'] }) {
  if (icon === 'heart') return <Heart className="mr-2 h-4 w-4" />;
  if (icon === 'clock') return <Clock className="mr-2 h-4 w-4" />;
  return <div className="mr-2 h-2 w-2 rounded-md bg-gray-500" />;
}

interface ArticleCardActions {
  onToolbarOpenChange: (id: string | null) => void;
  onCardClick: (event: MouseEvent<HTMLElement>, articleId: string) => void;
  onTagClick: (tag: string) => void;
  onToggleStatus: (id: string, status: ArticleStatus) => void;
  onAddToList: (articleId: string, listId: string) => void;
  onRemoveFromList: (articleId: string, listId: string) => void;
  onDeleteRequest: (articleId: string) => void;
}

interface ArticleCardProps {
  article: ArticleSummary;
  lists: List[];
  activeToolbarId: string | null;
  deletingId: string | null;
  actions: ArticleCardActions;
}

export function ArticleCard({
  article,
  lists,
  activeToolbarId,
  deletingId,
  actions,
}: ArticleCardProps) {
  const navigate = useNavigate();
  const {
    onToolbarOpenChange,
    onCardClick,
    onTagClick,
    onToggleStatus,
    onAddToList,
    onRemoveFromList,
    onDeleteRequest,
  } = actions;

  const nextStatus: ArticleStatus = article.status === 'read' ? 'in_progress' : 'read';
  const displayTitle = article.title || article.url;
  const isPDF = article.type === 'pdf';
  const isLink = article.type === 'link';
  const kind = getArticleKind(article);
  const KindIcon = kind.icon;
  const origin = getArticleOrigin(article);
  const contextLine = isLink ? null : getContextLine(article);
  const attachedLists = lists.filter((list) => article.listIds?.includes(list.id));
  const hasMetadata =
    (!isLink && Boolean(article.readingTimeMinutes)) ||
    (isPDF && Boolean(article.pdfMetadata?.pageCount)) ||
    (isPDF && Boolean(formatFileSize(article.pdfMetadata?.fileSize))) ||
    article.notesCount > 0;
  const cardTone = isLink ? 'border-l-zinc-700' : isPDF ? 'border-l-zinc-600' : 'border-l-zinc-500';

  return (
    <article
      key={article.id}
      onClick={(event) => {
        if (!isLink) {
          onCardClick(event, article.id);
          return;
        }
        if (event.defaultPrevented) return;
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.closest('button, a, input, textarea, select, [role="menuitem"]')
        ) {
          return;
        }
        window.open(article.url, '_blank', 'noopener,noreferrer');
      }}
      className={`reader-card group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-l-2 border-zinc-800 bg-zinc-950 p-0 transition-colors duration-150 hover:border-zinc-700 hover:bg-zinc-900/70 ${cardTone}`}
    >
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-[var(--accent-11)]">
              <KindIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium text-[var(--gray-11)]"
                title={`${kind.label} · ${origin}`}
              >
                {kind.label} · {origin}
              </p>
            </div>
          </div>
          <Badge variant="soft" className="shrink-0 rounded-md">
            {article.status === 'read' ? (isLink ? 'Done' : 'Read') : isLink ? 'Pending' : 'Unread'}
          </Badge>
        </div>

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pr-2">
            <h2
              className="line-clamp-2 text-lg leading-snug font-semibold break-words text-[var(--gray-12)]"
              title={displayTitle}
            >
              {displayTitle}
            </h2>
            {contextLine && (
              <p
                className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--gray-11)]"
                title={contextLine}
              >
                {contextLine}
              </p>
            )}
            {hasMetadata && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-300">
                {!isLink && article.readingTimeMinutes && (
                  <Badge variant="surface" className="gap-1 rounded-md">
                    <Clock className="h-3 w-3" />
                    {formatReadingTime(article.readingTimeMinutes)}
                  </Badge>
                )}
                {isPDF && article.pdfMetadata?.pageCount && (
                  <Badge variant="surface" className="rounded-md">
                    {article.pdfMetadata.pageCount} pages
                  </Badge>
                )}
                {isPDF && formatFileSize(article.pdfMetadata?.fileSize) && (
                  <Badge variant="surface" className="rounded-md">
                    {formatFileSize(article.pdfMetadata?.fileSize)}
                  </Badge>
                )}
                {article.notesCount > 0 && (
                  <Badge variant="surface" className="rounded-md">
                    {article.notesCount} notes
                  </Badge>
                )}
              </div>
            )}
            {(article.category || attachedLists.length > 0 || Boolean(article.tags?.length)) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {article.category && (
                  <Badge
                    variant="surface"
                    className="max-w-[9rem] truncate rounded-md"
                    title={article.category}
                  >
                    {article.category}
                  </Badge>
                )}
                {attachedLists.slice(0, 2).map((list) => (
                  <Badge
                    key={list.id}
                    variant="soft"
                    className="max-w-[8rem] truncate rounded-md"
                    title={list.name}
                  >
                    {list.name}
                  </Badge>
                ))}
                {(article.tags ?? []).map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick(tag);
                    }}
                    className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors ${getTagColor(tag)} hover:opacity-80`}
                  >
                    {tag}
                  </button>
                ))}
                {attachedLists.length > 2 && (
                  <Badge variant="soft" className="rounded-md">
                    +{attachedLists.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <DropdownMenu
            open={activeToolbarId === article.id}
            onOpenChange={(open) => {
              onToolbarOpenChange(open ? article.id : null);
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                aria-label="Article actions"
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onSelect={() => {
                  onToggleStatus(article.id, nextStatus);
                }}
              >
                {article.status === 'read'
                  ? isLink
                    ? 'Mark Pending'
                    : 'Mark In Progress'
                  : isLink
                    ? 'Mark Done'
                    : 'Mark Read'}
              </DropdownMenuItem>
              {isLink && (
                <DropdownMenuItem
                  onSelect={() => {
                    window.open(article.url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Open Link
                </DropdownMenuItem>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Add to list</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {lists
                    .filter((list) => !article.listIds?.includes(list.id))
                    .map((list) => (
                      <DropdownMenuItem
                        key={list.id}
                        onSelect={() => onAddToList(article.id, list.id)}
                      >
                        <ListIcon icon={list.icon} />
                        {list.name}
                      </DropdownMenuItem>
                    ))}
                  {lists.filter((list) => !article.listIds?.includes(list.id)).length === 0 && (
                    <DropdownMenuItem disabled>Already in all lists</DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {article.listIds && article.listIds.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Remove from list</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {lists
                      .filter((list) => article.listIds?.includes(list.id))
                      .map((list) => (
                        <DropdownMenuItem
                          key={list.id}
                          onSelect={() => onRemoveFromList(article.id, list.id)}
                          className="text-zinc-300 focus:text-zinc-100"
                        >
                          <ListIcon icon={list.icon} />
                          {list.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-300 focus:text-red-100"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onSelect={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (deletingId) return;
                  onDeleteRequest(article.id);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {article.byline && (
          <p className="line-clamp-1 text-sm text-gray-500 italic" title={article.byline}>
            By {article.byline}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 bg-black/20 px-5 py-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isLink ? 'default' : 'secondary'}
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              if (isLink) {
                window.open(article.url, '_blank', 'noopener,noreferrer');
                return;
              }
              navigate(`/reader/${article.id}`);
            }}
          >
            {isLink ? (
              <ExternalLink className="h-3.5 w-3.5" />
            ) : (
              <BookOpen className="h-3.5 w-3.5" />
            )}
            {kind.primaryAction}
          </Button>
          {!isLink && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 rounded-md px-3 text-xs"
              onClick={(event) => {
                event.stopPropagation();
                onToggleStatus(article.id, nextStatus);
              }}
            >
              {article.status === 'read' ? 'Mark unread' : 'Mark read'}
            </Button>
          )}
        </div>
        <span className="text-xs text-[var(--gray-11)]">{formatDate(article.createdAt)}</span>
      </div>
    </article>
  );
}
