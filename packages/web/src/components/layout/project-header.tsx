'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, Settings, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggleDropdown } from '@/components/ui/theme-toggle';
import { useAuth, useUser } from '@/components/providers/auth-provider';
import { useProjects } from '@/components/providers/project-provider';

interface ProjectHeaderProps {
  projectName?: string;
  className?: string;
  onMenuClick?: () => void;
  onSwitchProject?: () => void;
}

export function ProjectHeader({
  projectName,
  className,
  onMenuClick,
  onSwitchProject,
}: ProjectHeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const user = useUser();
  const { logout } = useAuth();
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  const userInitials = React.useMemo(() => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    return names.length >= 2
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : names[0].substring(0, 2).toUpperCase();
  }, [user?.name]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  return (
    <header
      className={cn(
        'flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Project name with switcher (mobile & desktop) */}
        <button
          onClick={onSwitchProject}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors lg:hidden"
        >
          <span className="text-sm font-semibold truncate max-w-[200px]">
            {projectName || 'Project'}
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggleDropdown />

        <div className="relative ml-2" ref={userMenuRef}>
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-2"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <Avatar size="sm">
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium lg:inline-block">
              {user?.name || 'User'}
            </span>
          </Button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-background py-1 shadow-lg z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => setUserMenuOpen(false)}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
