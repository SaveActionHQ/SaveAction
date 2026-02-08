'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileVideo,
  Play,
  Clock,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth, useUser } from '@/components/providers/auth-provider';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/recordings', label: 'Recordings', icon: FileVideo },
  { href: '/runs', label: 'Test Runs', icon: Play },
  { href: '/schedules', label: 'Schedules', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const user = useUser();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Get user initials for avatar fallback
  const userInitials = React.useMemo(() => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    return names.length >= 2
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : names[0].substring(0, 2).toUpperCase();
  }, [user?.name]);

  // Close on route change
  React.useEffect(() => {
    if (open) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Prevent body scroll when open
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

  const handleLogout = async () => {
    setIsLoggingOut(true);
    onClose();
    await logout();
    setIsLoggingOut(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border shadow-xl lg:hidden animate-in">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" onClick={onClose}>
            <Logo size="md" />
          </Link>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>

        {/* User Info */}
        <div className="border-b border-border p-4">
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

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-border p-4">
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
