'use client';

import * as React from 'react';
import { ProjectSidebar } from '@/components/layout/project-sidebar';
import { ProjectMobileNav } from '@/components/layout/project-mobile-nav';
import { ProjectHeader } from '@/components/layout/project-header';
import { ProjectSwitcher } from '@/components/projects/project-switcher';
import { useAuth } from '@/components/providers/auth-provider';
import { ProjectProvider } from '@/components/providers/project-provider';
import { useProjectFromSlug } from '@/lib/hooks';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectLayoutProps {
  children: React.ReactNode;
}

function ProjectSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar Skeleton */}
      <div className="hidden lg:flex w-64 flex-col border-r border-border bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-12 w-full mb-6" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
          <Skeleton className="h-10 w-64" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto bg-background-secondary p-4 lg:p-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </main>
      </div>
    </div>
  );
}

function ProjectLayoutInner({ children }: ProjectLayoutProps) {
  const { projectSlug, projectId, project } = useProjectFromSlug();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);

  const handleMobileNavClose = React.useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const handleMobileNavOpen = React.useCallback(() => {
    setMobileNavOpen(true);
  }, []);

  const handleOpenSwitcher = React.useCallback(() => {
    setSwitcherOpen(true);
  }, []);

  const handleCloseSwitcher = React.useCallback(() => {
    setSwitcherOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <ProjectSidebar
        projectId={projectId}
        projectSlug={projectSlug}
        projectName={project?.name}
        className="hidden lg:flex"
        onSwitchProject={handleOpenSwitcher}
      />

      {/* Mobile Navigation */}
      <ProjectMobileNav
        projectId={projectId}
        projectSlug={projectSlug}
        projectName={project?.name}
        open={mobileNavOpen}
        onClose={handleMobileNavClose}
        onSwitchProject={handleOpenSwitcher}
      />

      {/* Project Switcher Dialog */}
      <ProjectSwitcher
        open={switcherOpen}
        onClose={handleCloseSwitcher}
        currentProjectId={projectId}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ProjectHeader
          projectName={project?.name}
          onMenuClick={handleMobileNavOpen}
          onSwitchProject={handleOpenSwitcher}
        />
        <main className="flex-1 overflow-y-auto bg-background-secondary p-4 lg:p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <ProjectSkeleton />;
  }

  if (!isAuthenticated) {
    return <ProjectSkeleton />;
  }

  return (
    <ProjectProvider>
      <ProjectLayoutInner>{children}</ProjectLayoutInner>
    </ProjectProvider>
  );
}
