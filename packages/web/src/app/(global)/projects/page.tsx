'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjects } from '@/components/providers/project-provider';
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

function EditIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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

interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; color: string }) => Promise<void>;
  title: string;
  submitLabel: string;
  initialData?: {
    name: string;
    description: string;
    color: string;
  };
}

function ProjectDialog({
  open,
  onClose,
  onSubmit,
  title,
  submitLabel,
  initialData,
}: ProjectDialogProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [color, setColor] = useState(initialData?.color || PROJECT_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new data
  React.useEffect(() => {
    if (open) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setColor(initialData?.color || PROJECT_COLORS[0]);
      setError(null);
    }
  }, [open, initialData]);

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

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({ name: name.trim(), description: description.trim(), color });
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
              onChange={(e) => setName(e.target.value)}
              placeholder="My Test Project"
              disabled={isSubmitting}
              autoFocus
            />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  projectName: string;
}

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  projectName,
}: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isDeleting) {
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
  }, [open, isDeleting, onClose]);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={() => !isDeleting && onClose()}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-destructive">Delete Project</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{projectName}</strong>? This action cannot
          be undone. All recordings, runs, and schedules in this project will be deleted.
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Project'}
          </Button>
        </div>
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
  onEdit,
  onDelete,
}: {
  project: Project;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={`group transition-all hover:shadow-md ${
        isActive ? 'ring-2 ring-primary' : ''
      }`}
    >
      <Link href={`/projects/${project.id}`} className="block">
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
      </Link>
      <div className="flex items-center justify-between border-t border-border px-6 py-3">
        <p className="text-xs text-muted-foreground">
          Created {new Date(project.createdAt).toLocaleDateString()}
        </p>
        <div
          className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit project">
            <EditIcon className="h-3.5 w-3.5" />
          </Button>
          {!project.isDefault && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Delete project"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
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
    updateProject,
    deleteProject,
    refreshProjects,
  } = useProjects();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
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
    async (data: { name: string; description: string; color: string }) => {
      await createProject({
        name: data.name,
        description: data.description || undefined,
        color: data.color,
      });
    },
    [createProject]
  );

  const handleUpdateProject = useCallback(
    async (data: { name: string; description: string; color: string }) => {
      if (!editingProject) return;
      await updateProject(editingProject.id, {
        name: data.name,
        description: data.description || undefined,
        color: data.color,
      });
    },
    [editingProject, updateProject]
  );

  const handleDeleteProject = useCallback(async () => {
    if (!deletingProject) return;
    await deleteProject(deletingProject.id);
  }, [deletingProject, deleteProject]);

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
              onEdit={() => setEditingProject(project)}
              onDelete={() => setDeletingProject(project)}
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

      {/* Edit Dialog */}
      <ProjectDialog
        open={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSubmit={handleUpdateProject}
        title="Edit Project"
        submitLabel="Save Changes"
        initialData={
          editingProject
            ? {
                name: editingProject.name,
                description: editingProject.description || '',
                color: editingProject.color || PROJECT_COLORS[0],
              }
            : undefined
        }
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDeleteProject}
        projectName={deletingProject?.name || ''}
      />
    </div>
  );
}
