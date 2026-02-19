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
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { SuiteTreeNav } from './suite-tree-nav';

interface ProjectSidebarProps {
  projectId: string;
  projectSlug: string;
  projectName?: string;
  className?: string;
  onSwitchProject?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function ProjectSidebar({
  projectId,
  projectSlug,
  projectName,
  className,
  onSwitchProject,
}: ProjectSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  const basePath = `/projects/${projectSlug}`;

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

  const renderNavItem = (item: NavItem) => {
    const isActive = isNavActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon
          className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')}
        />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-sidebar-border bg-sidebar-background transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border px-4',
          collapsed && 'justify-center'
        )}
      >
        <Link href="/projects">
          <Logo showText={!collapsed} size={collapsed ? 'sm' : 'md'} />
        </Link>
      </div>

      {/* Project Name + Switcher */}
      <div
        className={cn(
          'border-b border-sidebar-border p-3',
          collapsed && 'px-2'
        )}
      >
        {collapsed ? (
          <button
            onClick={onSwitchProject}
            className="flex items-center justify-center w-full"
            title={projectName || 'Switch project'}
          >
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
              <span className="text-xs font-bold text-primary">
                {projectName?.[0]?.toUpperCase() || 'P'}
              </span>
            </div>
          </button>
        ) : (
          <button
            onClick={onSwitchProject}
            className="w-full text-left rounded-lg p-2 hover:bg-sidebar-accent transition-colors group"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Project
              </p>
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-1 text-sm font-semibold truncate">
              {projectName || 'Loading...'}
            </p>
          </button>
        )}
      </div>

      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview nav */}
        <nav className="space-y-1 p-2">
          {topNavItems.map(renderNavItem)}
        </nav>

        {/* Suite tree (only when expanded) */}
        {!collapsed && (
          <div className="border-t border-sidebar-border pt-2 pb-2">
            <SuiteTreeNav projectId={projectId} projectSlug={projectSlug} collapsed={collapsed} />
          </div>
        )}

        {/* Bottom nav items */}
        <nav className="space-y-1 p-2 border-t border-sidebar-border">
          {bottomNavItems.map(renderNavItem)}
        </nav>
      </div>

      {/* Back to All Projects */}
      <div className="border-t border-sidebar-border p-2">
        <Link
          href="/projects"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'All Projects' : undefined}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>All Projects</span>}
        </Link>
      </div>

      {/* Collapse Toggle */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full', collapsed && 'px-2')}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-2">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
