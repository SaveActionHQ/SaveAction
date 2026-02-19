'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  MoreHorizontal,
  Trash2,
  TestTube2,
  Clock,
  Globe,
  Settings2,
  FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Test } from '@/lib/api';

const BROWSER_LABELS: Record<string, string> = {
  chromium: 'Chrome',
  firefox: 'Firefox',
  webkit: 'Safari',
};

function formatRelativeTime(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface TestCardProps {
  test: Test;
  projectSlug: string;
  suiteId: string;
  onEdit?: (test: Test) => void;
  onDelete?: (test: Test) => void;
}

export function TestCard({
  test,
  projectSlug,
  suiteId,
  onEdit,
  onDelete,
}: TestCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const statusBadge = () => {
    if (test.lastRunStatus === 'completed') return <Badge variant="success-soft">Passed</Badge>;
    if (test.lastRunStatus === 'failed') return <Badge variant="destructive-soft">Failed</Badge>;
    if (test.lastRunStatus === 'running') return <Badge variant="primary-soft">Running</Badge>;
    return <Badge variant="secondary">No runs</Badge>;
  };

  return (
    <Card className="group relative transition-all hover:shadow-md">
      <Link
        href={`/projects/${projectSlug}/suites/${suiteId}/tests/${test.id}`}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">View {test.name}</span>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
              <TestTube2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold truncate">{test.name}</h3>
              {test.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {test.description}
                </p>
              )}

              {/* Browsers */}
              <div className="flex items-center gap-2 mt-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex gap-1">
                  {test.browsers.map((b) => (
                    <Badge key={b} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {BROWSER_LABELS[b] || b}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {test.actionCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {test.actionCount} actions
                  </span>
                )}
                {test.lastRunAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(test.lastRunAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 z-10 shrink-0">
            {statusBadge()}

            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(!menuOpen);
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-background py-1 shadow-lg z-50">
                  {onEdit && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        setMenuOpen(false);
                        onEdit(test);
                      }}
                    >
                      <Settings2 className="h-4 w-4" />
                      Edit Config
                    </button>
                  )}
                  {!onEdit && (
                    <Link
                      href={`/projects/${projectSlug}/suites/${suiteId}/tests/${test.id}/edit`}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Settings2 className="h-4 w-4" />
                      Edit Config
                    </Link>
                  )}
                  {onDelete && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        setMenuOpen(false);
                        onDelete(test);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Test
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TestCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
      </div>
    </Card>
  );
}
