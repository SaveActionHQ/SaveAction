'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, Menu, Search, X, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggleDropdown } from '@/components/ui/theme-toggle';
import { useAuth, useUser } from '@/components/providers/auth-provider';

interface HeaderProps {
  className?: string;
  onMenuClick?: () => void;
}

export function Header({ className, onMenuClick }: HeaderProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const user = useUser();
  const { logout } = useAuth();
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Get user initials for avatar fallback
  const userInitials = React.useMemo(() => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    return names.length >= 2
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : names[0].substring(0, 2).toUpperCase();
  }, [user?.name]);

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
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
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Search */}
        <div className="hidden md:flex items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search recordings, runs..."
              className="w-64 pl-9 lg:w-80"
            />
          </div>
        </div>

        {/* Mobile Search Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          {searchOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Search className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle search</span>
        </Button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <ThemeToggleDropdown />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            3
          </span>
          <span className="sr-only">View notifications</span>
        </Button>

        {/* User Menu */}
        <div className="relative ml-2" ref={userMenuRef}>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 px-2"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <Avatar size="sm">
              <AvatarImage src="/avatar.png" alt="User avatar" />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium lg:inline-block">
              {user?.name || 'User'}
            </span>
          </Button>

          {/* User Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-background py-1 shadow-lg z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Link
                href="/settings/profile"
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => setUserMenuOpen(false)}
              >
                <UserIcon className="h-4 w-4" />
                Profile
              </Link>
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

      {/* Mobile Search Bar */}
      {searchOpen && (
        <div className="absolute left-0 right-0 top-16 z-50 border-b border-border bg-background p-4 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search recordings, runs..."
              className="w-full pl-9"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
