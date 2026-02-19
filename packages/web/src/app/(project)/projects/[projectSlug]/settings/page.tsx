'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Settings, AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { useProjects } from '@/components/providers/project-provider';
import { useProjectFromSlug, useSlugCheck } from '@/lib/hooks';
import { useToast } from '@/components/providers/toast-provider';
import type { SlugStatus } from '@/lib/hooks';

// ─── Color Presets ──────────────────────────────────────────

const COLOR_PRESETS = [
  '#5D5FEF', // Purple (brand)
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
];

// ─── Slug validation ────────────────────────────────────────

function SlugStatusIcon({ status }: { status: SlugStatus }) {
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

// ─── Main Page ──────────────────────────────────────────────

export default function ProjectSettingsPage() {
  const router = useRouter();
  const { projectId, project } = useProjectFromSlug();
  const { updateProject, deleteProject, refreshProjects } = useProjects();
  const { success, error: toastError } = useToast();

  // General form state
  const [name, setName] = React.useState('');
  const {
    slug,
    setSlugValue,
    setSlug: setSlugDirect,
    slugStatus,
    slugError,
    slugBlocked,
  } = useSlugCheck({
    excludeProjectId: projectId || undefined,
    originalSlug: project?.slug,
  });
  const [description, setDescription] = React.useState('');
  const [color, setColor] = React.useState('#5D5FEF');
  const [isSaving, setIsSaving] = React.useState(false);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Initialize form when project loads
  React.useEffect(() => {
    if (project) {
      setName(project.name);
      setSlugDirect(project.slug);
      setDescription(project.description || '');
      setColor(project.color || '#5D5FEF');
    }
  }, [project, setSlugDirect]);

  // Check if form has changes
  const hasChanges = React.useMemo(() => {
    if (!project) return false;
    return (
      name !== project.name ||
      slug !== project.slug ||
      description !== (project.description || '') ||
      color !== (project.color || '#5D5FEF')
    );
  }, [project, name, slug, description, color]);

  // Save general settings
  const handleSave = async () => {
    if (!project || !hasChanges || slugBlocked || slugStatus === 'checking') return;

    setIsSaving(true);
    try {
      const updateData: Record<string, string> = {};
      if (name !== project.name) updateData.name = name;
      if (slug !== project.slug) updateData.slug = slug;
      if (description !== (project.description || '')) updateData.description = description;
      if (color !== (project.color || '#5D5FEF')) updateData.color = color;

      await updateProject(projectId, updateData);
      success('Settings saved', 'Project settings have been updated.');

      // If slug changed, redirect to new URL
      if (slug !== project.slug) {
        await refreshProjects();
        router.replace(`/projects/${slug}/settings`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      toastError('Save failed', msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete project
  const handleDelete = async () => {
    if (!project) return;

    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      success('Project deleted', `"${project.name}" has been permanently deleted.`);
      router.push('/projects');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project';
      toastError('Delete failed', msg);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const canDelete = deleteConfirmText === project?.name;

  if (!project) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Project Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage settings for{' '}
          <span className="font-medium text-foreground">{project.name}</span>
        </p>
      </div>

      {/* ─── General Settings ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Update your project name, slug, description, and color.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              maxLength={255}
            />
          </div>

          {/* Project Slug */}
          <div className="space-y-2">
            <Label htmlFor="project-slug">Project slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                /projects/
              </span>
              <Input
                id="project-slug"
                value={slug}
                onChange={(e) => setSlugValue(e.target.value)}
                placeholder="my-project"
                maxLength={100}
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
                Used in URLs. Lowercase letters, numbers, and hyphens only.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project"
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Describe the purpose of this project.
            </p>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Project color</Label>
            <div className="flex items-center gap-3">
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-8 w-8 rounded-full border-2 transition-all cursor-pointer hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor:
                        color === c ? 'var(--foreground)' : 'transparent',
                    }}
                    onClick={() => setColor(c)}
                    title={c}
                  >
                    {color === c && (
                      <Check className="h-4 w-4 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 p-0 border-0 cursor-pointer"
                title="Custom color"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {hasChanges ? 'You have unsaved changes.' : 'All changes saved.'}
            </p>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || slugBlocked || slugStatus === 'checking'}
              isLoading={isSaving}
            >
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Danger Zone ───────────────────────────────────── */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/30 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Delete this project</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Once you delete a project, there is no going back. This will
                  permanently delete the{' '}
                  <span className="font-medium text-foreground">
                    {project.name}
                  </span>{' '}
                  project, all test suites, tests, recordings, runs, and
                  schedules associated with it.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0"
                onClick={() => setShowDeleteDialog(true)}
                disabled={project.isDefault}
              >
                Delete project
              </Button>
            </div>
            {project.isDefault && (
              <p className="text-xs text-muted-foreground mt-3 italic">
                The default project cannot be deleted.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Delete Confirmation Dialog ────────────────────── */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setDeleteConfirmText('');
        }}
      >
        <DialogHeader
          onClose={() => {
            setShowDeleteDialog(false);
            setDeleteConfirmText('');
          }}
        >
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-muted-foreground">
                This will permanently delete the{' '}
                <strong className="text-foreground">{project.name}</strong>{' '}
                project and all of its data including test suites, tests,
                recordings, runs, and schedules.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                To confirm, type{' '}
                <span className="font-mono font-semibold text-foreground">
                  {project.name}
                </span>{' '}
                below:
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={project.name}
                autoComplete="off"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteDialog(false);
              setDeleteConfirmText('');
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
            isLoading={isDeleting}
          >
            Delete this project
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
