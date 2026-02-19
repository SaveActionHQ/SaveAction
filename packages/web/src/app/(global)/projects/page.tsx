'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjects } from '@/components/providers/project-provider';
import { useSlugCheck, slugify, isValidSlug } from '@/lib/hooks';
import type { Project } from '@/lib/api';

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Color options for projects
const PROJECT_COLORS = [
  '#5D5FEF', // SaveAction brand
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

// ─── Slug status indicator ──────────────────────────────────

function SlugStatusIcon({ status }: { status: string }) {
  if (status === 'checking') {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
  if (status === 'available') {
    return <Check className="h-4 w-4 text-emerald-500" />;
  }
  if (status === 'taken' || status === 'invalid') {
    return <X className="h-4 w-4 text-destructive" />;
  }
  return null;
}

interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; slug: string; description: string; color: string }) => Promise<void>;
  title: string;
  submitLabel: string;
}

function ProjectDialog({
  open,
  onClose,
  onSubmit,
  title,
  submitLabel,
}: ProjectDialogProps) {
  const [name, setName] = useState('');
  const { slug, setSlugValue, slugStatus, slugError, slugBlocked } = useSlugCheck();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName('');
      setSlugValue('');
      setSlugManuallyEdited(false);
      setDescription('');
      setColor(PROJECT_COLORS[0]);
      setError(null);
    }
  }, [open, setSlugValue]);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isSubmitting) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    const finalSlug = slug || slugify(name);
    if (!isValidSlug(finalSlug)) {
      setError('Invalid slug. Use lowercase letters, numbers, and hyphens.');
      return;
    }
    if (slugBlocked) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({ name: name.trim(), slug: finalSlug, description: description.trim(), color });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="project-name" className="text-sm font-medium">
              Project Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugManuallyEdited) {
                  setSlugValue(slugify(e.target.value));
                }
              }}
              placeholder="My Test Project"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="project-slug" className="text-sm font-medium">
              Project Slug <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                /projects/
              </span>
              <Input
                id="project-slug"
                value={slug}
                onChange={(e) => {
                  const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  setSlugValue(cleaned);
                  setSlugManuallyEdited(true);
                }}
                placeholder="my-test-project"
                disabled={isSubmitting}
                className={slugError ? 'border-destructive' : slugStatus === 'available' ? 'border-emerald-500' : ''}
              />
              <div className="flex items-center justify-center w-6">
                <SlugStatusIcon status={slugStatus} />
              </div>
            </div>
            {slugError ? (
              <p className="text-xs text-destructive">{slugError}</p>
            ) : slugStatus === 'available' ? (
              <p className="text-xs text-emerald-500">Slug is available!</p>
            ) : slugStatus === 'checking' ? (
              <p className="text-xs text-muted-foreground">Checking availability...</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Used in URLs. Auto-generated from name or customize it.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="project-description" className="text-sm font-medium">
              Description
            </label>
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for the project"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  style={{ backgroundColor: c }}
                  disabled={isSubmitting}
                >
                  {color === c && (
                    <CheckIcon className="absolute inset-0 m-auto h-4 w-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || slugBlocked || slugStatus === 'checking'}>
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

// Project Card Component
function ProjectCard({
  project,
  isActive,
}: {
  project: Project;
  isActive: boolean;
}) {
  return (
    <Link href={`/projects/${project.slug}`} className="block">
      <Card
        className={`group transition-all hover:shadow-md ${
          isActive ? 'ring-2 ring-primary' : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: project.color || '#5D5FEF' }}
              >
                <FolderIcon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="truncate">{project.name}</span>
                  {project.isDefault && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Default
                    </Badge>
                  )}
                  {isActive && (
                    <Badge variant="default" className="shrink-0 text-xs">
                      Active
                    </Badge>
                  )}
                </CardTitle>
                {project.description && (
                  <CardDescription className="mt-1 line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </div>
            </div>
            <ArrowRightIcon className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardHeader>
        <div className="border-t border-border px-6 py-3">
          <p className="text-xs text-muted-foreground">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
      </Card>
    </Link>
  );
}

// Empty State Component
function EmptyState({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FolderIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        Projects help you organize your recordings, test runs, and schedules. Create your first
        project to get started.
      </p>
      <Button onClick={onCreateClick} className="mt-6">
        <PlusIcon className="mr-2 h-4 w-4" />
        Create Project
      </Button>
    </div>
  );
}

// Loading Skeleton
function ProjectsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
              </div>
            </div>
          </CardHeader>
          <div className="border-t border-border px-6 py-3">
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const {
    projects,
    activeProject,
    isLoading,
    error,
    createProject,
    refreshProjects,
  } = useProjects();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter projects by search query
  const filteredProjects = React.useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const handleCreateProject = useCallback(
    async (data: { name: string; slug: string; description: string; color: string }) => {
      await createProject({
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        color: data.color,
      });
    },
    [createProject]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your projects to organize recordings, runs, and schedules.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div className="relative max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshProjects}
            className="mt-2 text-destructive hover:text-destructive"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && <ProjectsSkeleton />}

      {/* Empty State */}
      {!isLoading && !error && projects.length === 0 && (
        <EmptyState onCreateClick={() => setShowCreateDialog(true)} />
      )}

      {/* No Search Results */}
      {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <p className="text-sm text-muted-foreground">
            No projects match &quot;{searchQuery}&quot;
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="mt-2"
          >
            Clear search
          </Button>
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isActive={activeProject?.id === project.id}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <ProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateProject}
        title="Create Project"
        submitLabel="Create Project"
      />
    </div>
  );
}
