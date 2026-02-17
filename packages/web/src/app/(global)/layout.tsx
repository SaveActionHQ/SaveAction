'use client';

import * as React from 'react';
import { GlobalSidebar } from '@/components/layout/global-sidebar';
import { GlobalMobileNav } from '@/components/layout/global-mobile-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/components/providers/auth-provider';
import { ProjectProvider } from '@/components/providers/project-provider';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { Skeleton } from '@/components/ui/skeleton';

interface GlobalLayoutProps {
  children: React.ReactNode;
}

function GlobalSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar Skeleton */}
      <div className="hidden lg:flex w-64 flex-col border-r border-border bg-background p-4">
        <Skeleton className="h-8 w-32 mb-8" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
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
          </div>
        </main>
      </div>
    </div>
  );
}

export default function GlobalLayout({ children }: GlobalLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const { isLoading, isAuthenticated } = useAuth();

  const handleMobileNavClose = React.useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const handleMobileNavOpen = React.useCallback(() => {
    setMobileNavOpen(true);
  }, []);

  if (isLoading) {
    return <GlobalSkeleton />;
  }

  if (!isAuthenticated) {
    return <GlobalSkeleton />;
  }

  return (
    <ProjectProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <GlobalSidebar className="hidden lg:flex" />

        {/* Mobile Navigation */}
        <GlobalMobileNav open={mobileNavOpen} onClose={handleMobileNavClose} />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={handleMobileNavOpen} />
          <main className="flex-1 overflow-y-auto bg-background-secondary p-4 lg:p-6">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ProjectProvider>
  );
}
