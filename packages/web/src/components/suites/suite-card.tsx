'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  MoreHorizontal,
  Play,
  Pencil,
  Trash2,
  TestTube2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TestSuiteWithStats } from '@/lib/api';

interface SuiteCardProps {
  suite: TestSuiteWithStats;
  projectSlug: string;
  onEdit?: (suite: TestSuiteWithStats) => void;
  onDelete?: (suite: TestSuiteWithStats) => void;
  onRun?: (suite: TestSuiteWithStats) => void;
}

export function SuiteCard({
  suite,
  projectSlug,
  onEdit,
  onDelete,
  onRun,
}: SuiteCardProps) {
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

  const formatRelativeTime = (dateStr: string | null | undefined) => {
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
  };

  return (
    <Card className="group relative transition-all hover:shadow-md">
      <Link
        href={`/projects/${projectSlug}/suites/${suite.id}`}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">View {suite.name}</span>
      </Link>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="truncate">{suite.name}</span>
                {suite.isDefault && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    Default
                  </Badge>
                )}
              </CardTitle>
              {suite.description && (
                <CardDescription className="mt-1 line-clamp-2">
                  {suite.description}
                </CardDescription>
              )}
            </div>
          </div>

          {/* Action menu */}
          <div className="relative z-10" ref={menuRef}>
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
                {onRun && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      onRun(suite);
                    }}
                  >
                    <Play className="h-4 w-4" />
                    Run Suite
                  </button>
                )}
                {onEdit && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      onEdit(suite);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Suite
                  </button>
                )}
                {onDelete && !suite.isDefault && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      onDelete(suite);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Suite
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Stats footer */}
      <div className="border-t border-border px-6 py-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TestTube2 className="h-3.5 w-3.5" />
            {suite.testCount} {suite.testCount === 1 ? 'test' : 'tests'}
          </span>
          {suite.passRate != null && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {Math.round(suite.passRate)}% pass
            </span>
          )}
          {suite.lastRunAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatRelativeTime(suite.lastRunAt)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

// Loading skeleton for SuiteCard
export function SuiteCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
          </div>
        </div>
      </CardHeader>
      <div className="border-t border-border px-6 py-3">
        <div className="flex gap-4">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
    </Card>
  );
}
