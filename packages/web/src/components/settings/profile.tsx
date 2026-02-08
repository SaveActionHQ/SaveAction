'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/providers/toast-provider';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';

function UserIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
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
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = React.useState(user?.name || '');
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Update name when user data changes
  React.useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  // Track changes
  React.useEffect(() => {
    setHasChanges(name !== (user?.name || ''));
  }, [name, user?.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasChanges) return;

    setIsLoading(true);
    try {
      await api.updateProfile({ name: name.trim() || undefined });
      await refreshUser();
      addToast({
        type: 'success',
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
      setHasChanges(false);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to update profile',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setName(user?.name || '');
  };

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your account profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your name will be displayed throughout the app
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <div className="flex items-center gap-2">
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed at this time
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" isLoading={isLoading} disabled={!hasChanges}>
                Save Changes
              </Button>
              {hasChanges && (
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailIcon className="h-5 w-5" />
            Account Details
          </CardTitle>
          <CardDescription>Your account information and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">Account ID</span>
              <p className="font-mono text-sm">{user?.id}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">Account Status</span>
              <p>
                {user?.isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Inactive
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">Member Since</span>
              <p className="text-sm">{formatDate(user?.createdAt || null)}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">Email Verified</span>
              <p className="text-sm">
                {user?.emailVerifiedAt
                  ? formatDate(user.emailVerifiedAt)
                  : 'Not verified'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
