'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Check, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/components/providers/project-provider';
import type { Project } from '@/lib/api';

interface ProjectSwitcherProps {
  open: boolean;
  onClose: () => void;
  currentProjectId?: string;
}

export function ProjectSwitcher({
  open,
  onClose,
  currentProjectId,
}: ProjectSwitcherProps) {
  const router = useRouter();
  const { projects } = useProjects();
  const [search, setSearch] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus search input when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearch('');
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const filteredProjects = React.useMemo(() => {
    if (!search.trim()) return projects;
    const query = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [projects, search]);

  const handleSelect = (project: Project) => {
    onClose();
    router.push(`/projects/${project.id}`);
  };

  const handleCreateNew = () => {
    onClose();
    router.push('/projects?new=true');
  };

  const getProjectInitials = (name: string) => {
    const words = name.split(/\s+/);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const PROJECT_COLORS = [
    '#5D5FEF', // Brand purple
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
  ];

  const getProjectColor = (project: Project) => {
    if (project.color) return project.color;
    // Deterministic color based on project name
    let hash = 0;
    for (let i = 0; i < project.name.length; i++) {
      hash = project.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-sm">
      <DialogHeader onClose={onClose}>
        <DialogTitle>Switch Project</DialogTitle>
      </DialogHeader>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            'w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary'
          )}
        />
      </div>

      {/* Project list */}
      <div className="max-h-[300px] overflow-y-auto -mx-1">
        {filteredProjects.length === 0 ? (
          <div className="py-8 text-center">
            <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No projects match your search' : 'No projects yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 px-1">
            {filteredProjects.map((project) => {
              const isCurrent = project.id === currentProjectId;
              const color = getProjectColor(project);

              return (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    isCurrent
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  )}
                >
                  {/* Project avatar */}
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {getProjectInitials(project.name)}
                  </div>

                  {/* Project info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Current indicator */}
                  {isCurrent && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}

                  {/* Default badge */}
                  {project.isDefault && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      Default
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create new project */}
      <div className="mt-3 pt-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleCreateNew}
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>
    </Dialog>
  );
}
