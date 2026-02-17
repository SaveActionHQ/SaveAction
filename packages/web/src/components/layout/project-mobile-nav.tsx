'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Play,
  Clock,
  Settings,
  Library,
  X,
  LogOut,
  ArrowLeft,
  ChevronsUpDown,
  FolderOpen,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth, useUser } from '@/components/providers/auth-provider';
import { api, TestSuiteWithStats, Test } from '@/lib/api';

interface ProjectMobileNavProps {
  projectId: string;
  projectName?: string;
  open: boolean;
  onClose: () => void;
  onSwitchProject?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SuiteWithTests {
  suite: TestSuiteWithStats;
  expanded: boolean;
  tests: Test[];
  loading: boolean;
}

export function ProjectMobileNav({
  projectId,
  projectName,
  open,
  onClose,
  onSwitchProject,
}: ProjectMobileNavProps) {
  const pathname = usePathname();
  const user = useUser();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [suites, setSuites] = React.useState<SuiteWithTests[]>([]);
  const [suitesLoading, setSuitesLoading] = React.useState(false);

  const basePath = `/projects/${projectId}`;

  const topNavItems: NavItem[] = [
    { href: basePath, label: 'Overview', icon: LayoutDashboard },
  ];

  const bottomNavItems: NavItem[] = [
    { href: `${basePath}/runs`, label: 'Run History', icon: Play },
    { href: `${basePath}/schedules`, label: 'Schedules', icon: Clock },
    { href: `${basePath}/library`, label: 'Library', icon: Library },
    { href: `${basePath}/settings`, label: 'Project Settings', icon: Settings },
  ];

  const isNavActive = (href: string) => {
    if (href === basePath) {
      return pathname === basePath;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const userInitials = React.useMemo(() => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    return names.length >= 2
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : names[0].substring(0, 2).toUpperCase();
  }, [user?.name]);

  // Load suites when nav opens
  React.useEffect(() => {
    if (open && projectId && suites.length === 0) {
      setSuitesLoading(true);
      api
        .listAllSuites(projectId)
        .then((data) => {
          setSuites(
            data.map((s) => ({
              suite: s,
              expanded: false,
              tests: [],
              loading: false,
            }))
          );
        })
        .catch(() => {
          // Silently fail for mobile nav
        })
        .finally(() => setSuitesLoading(false));
    }
  }, [open, projectId, suites.length]);

  // Close nav on pathname change
  React.useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const toggleSuite = async (index: number) => {
    const suite = suites[index];
    if (suite.expanded) {
      setSuites((prev) =>
        prev.map((s, i) => (i === index ? { ...s, expanded: false } : s))
      );
      return;
    }

    // Load tests if not already loaded
    if (suite.tests.length === 0) {
      setSuites((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, loading: true, expanded: true } : s
        )
      );
      try {
        const result = await api.listTests(projectId, { suiteId: suite.suite.id });
        setSuites((prev) =>
          prev.map((s, i) =>
            i === index
              ? { ...s, tests: result.data, loading: false }
              : s
          )
        );
      } catch {
        setSuites((prev) =>
          prev.map((s, i) =>
            i === index ? { ...s, loading: false, expanded: true } : s
          )
        );
      }
    } else {
      setSuites((prev) =>
        prev.map((s, i) => (i === index ? { ...s, expanded: true } : s))
      );
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    onClose();
    await logout();
    setIsLoggingOut(false);
  };

  const handleSwitchProject = () => {
    onClose();
    onSwitchProject?.();
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = isNavActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-secondary'
        )}
        onClick={onClose}
      >
        <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
        <span>{item.label}</span>
      </Link>
    );
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-background border-r border-border shadow-xl lg:hidden animate-in">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4 shrink-0">
          <Link href="/projects" onClick={onClose}>
            <Logo size="md" />
          </Link>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>

        {/* User Info */}
        <div className="border-b border-border p-4 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
        </div>

        {/* Project Name – clickable for switcher */}
        <div className="border-b border-border shrink-0">
          <button
            onClick={handleSwitchProject}
            className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
          >
            <div className="text-left">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Project
              </p>
              <p className="mt-1 text-sm font-semibold truncate">
                {projectName || 'Loading...'}
              </p>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* Top Nav */}
          {topNavItems.map(renderNavItem)}

          {/* Suite Tree Section */}
          <div className="pt-2 mt-2 border-t border-border">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Test Suites
            </p>

            {suitesLoading ? (
              <div className="space-y-2 px-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : suites.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No test suites yet
              </p>
            ) : (
              suites.map((item, index) => {
                const suiteHref = `${basePath}/suites/${item.suite.id}`;
                const isSuiteActive =
                  pathname === suiteHref || pathname.startsWith(`${suiteHref}/`);

                return (
                  <div key={item.suite.id}>
                    {/* Suite row */}
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleSuite(index)}
                        className="p-1.5 hover:bg-muted rounded transition-colors"
                      >
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            item.expanded && 'rotate-90'
                          )}
                        />
                      </button>
                      <Link
                        href={suiteHref}
                        className={cn(
                          'flex-1 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                          isSuiteActive
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        )}
                        onClick={onClose}
                      >
                        <FolderOpen
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isSuiteActive
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          )}
                        />
                        <span className="truncate">{item.suite.name}</span>
                        {item.suite.testCount > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {item.suite.testCount}
                          </span>
                        )}
                      </Link>
                    </div>

                    {/* Tests list */}
                    {item.expanded && (
                      <div className="ml-6 pl-3 border-l border-border space-y-0.5">
                        {item.loading ? (
                          <div className="py-1">
                            <div className="h-6 rounded bg-muted animate-pulse" />
                          </div>
                        ) : item.tests.length === 0 ? (
                          <p className="py-1 text-xs text-muted-foreground">
                            No tests
                          </p>
                        ) : (
                          item.tests.map((test) => {
                            const testHref = `${suiteHref}/tests/${test.id}`;
                            const isTestActive = pathname === testHref;
                            return (
                              <Link
                                key={test.id}
                                href={testHref}
                                className={cn(
                                  'flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
                                  isTestActive
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                )}
                                onClick={onClose}
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{test.name}</span>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Nav */}
          <div className="pt-2 mt-2 border-t border-border">
            {bottomNavItems.map(renderNavItem)}
          </div>

          {/* Back to projects */}
          <div className="pt-2 mt-2 border-t border-border">
            <Link
              href="/projects"
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-secondary transition-colors"
              onClick={onClose}
            >
              <ArrowLeft className="h-5 w-5" />
              <span>All Projects</span>
            </Link>
          </div>
        </nav>

        {/* Logout */}
        <div className="border-t border-border p-4 shrink-0">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="h-5 w-5" />
            <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
          </Button>
        </div>
      </div>
    </>
  );
}
