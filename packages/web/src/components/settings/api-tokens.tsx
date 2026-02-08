'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  ConfirmDialog,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/providers/toast-provider';
import { api, ApiToken, ApiTokenScope, API_TOKEN_SCOPES, CreateTokenResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

function KeyIcon({ className }: { className?: string }) {
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
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function BanIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'Never' },
];

const SCOPE_DESCRIPTIONS: Record<ApiTokenScope, string> = {
  'recordings:read': 'View recordings',
  'recordings:write': 'Create, update, delete recordings',
  'runs:read': 'View test runs',
  'runs:execute': 'Execute test runs',
  'schedules:read': 'View schedules',
  'schedules:write': 'Create, update, delete schedules',
  'webhooks:read': 'View webhooks',
  'webhooks:write': 'Create, update, delete webhooks',
};

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

interface CreateTokenFormData {
  name: string;
  scopes: ApiTokenScope[];
  expiresIn: string;
}

export function ApiTokensSettings() {
  const { addToast } = useToast();
  const [tokens, setTokens] = React.useState<ApiToken[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRevoking, setIsRevoking] = React.useState(false);

  // Dialogs state
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showTokenDialog, setShowTokenDialog] = React.useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState<CreateTokenFormData>({
    name: '',
    scopes: [],
    expiresIn: '30',
  });

  // Created token (shown once)
  const [createdToken, setCreatedToken] = React.useState<CreateTokenResponse | null>(null);
  const [tokenCopied, setTokenCopied] = React.useState(false);

  // Token to revoke/delete
  const [selectedToken, setSelectedToken] = React.useState<ApiToken | null>(null);

  // Fetch tokens
  const fetchTokens = React.useCallback(async () => {
    try {
      const response = await api.listApiTokens();
      setTokens(response.tokens);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to load tokens',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Create token
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      addToast({ type: 'error', title: 'Token name is required' });
      return;
    }
    if (formData.scopes.length === 0) {
      addToast({ type: 'error', title: 'Select at least one scope' });
      return;
    }

    setIsCreating(true);
    try {
      // Calculate expiration date
      let expiresAt: string | null = null;
      if (formData.expiresIn !== 'never') {
        const days = parseInt(formData.expiresIn, 10);
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiresAt = date.toISOString();
      }

      const token = await api.createApiToken({
        name: formData.name.trim(),
        scopes: formData.scopes,
        expiresAt,
      });
      setCreatedToken(token);
      setShowCreateDialog(false);
      setShowTokenDialog(true);
      setFormData({ name: '', scopes: [], expiresIn: '30' });
      await fetchTokens();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to create token',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Copy token to clipboard
  const handleCopyToken = async () => {
    if (!createdToken?.token) return;
    try {
      await navigator.clipboard.writeText(createdToken.token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      addToast({ type: 'error', title: 'Failed to copy token' });
    }
  };

  // Revoke token
  const handleRevoke = async () => {
    if (!selectedToken) return;
    setIsRevoking(true);
    try {
      await api.revokeApiToken(selectedToken.id);
      addToast({ type: 'success', title: 'Token revoked' });
      setShowRevokeDialog(false);
      setSelectedToken(null);
      await fetchTokens();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to revoke token',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  // Delete token
  const handleDelete = async () => {
    if (!selectedToken) return;
    setIsDeleting(true);
    try {
      await api.deleteApiToken(selectedToken.id);
      addToast({ type: 'success', title: 'Token deleted' });
      setShowDeleteDialog(false);
      setSelectedToken(null);
      await fetchTokens();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to delete token',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle scope selection
  const toggleScope = (scope: ApiTokenScope) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  // Select all scopes
  const selectAllScopes = () => {
    setFormData((prev) => ({
      ...prev,
      scopes: [...API_TOKEN_SCOPES],
    }));
  };

  const activeTokens = tokens.filter((t) => !t.revokedAt);
  const revokedTokens = tokens.filter((t) => t.revokedAt);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyIcon className="h-5 w-5" />
            API Tokens
          </CardTitle>
          <CardDescription>Manage API tokens for programmatic access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyIcon className="h-5 w-5" />
                API Tokens
              </CardTitle>
              <CardDescription>Manage API tokens for programmatic access</CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeTokens.length === 0 && revokedTokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <KeyIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No API tokens</p>
              <p className="text-sm mt-1">Create a token to access the API programmatically</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Tokens */}
              {activeTokens.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Active Tokens</h4>
                  <div className="divide-y divide-border rounded-lg border">
                    {activeTokens.map((token) => (
                      <div key={token.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{token.name}</span>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {token.tokenPrefix}...{token.tokenSuffix}
                              </code>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {token.scopes.map((scope) => (
                                <Badge key={scope} variant="secondary" className="text-xs">
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                            <div className="text-xs text-muted-foreground space-x-4">
                              <span>Created {formatDate(token.createdAt)}</span>
                              <span>Last used {formatRelativeTime(token.lastUsedAt)}</span>
                              {token.expiresAt && (
                                <span
                                  className={cn(
                                    new Date(token.expiresAt) < new Date() && 'text-destructive'
                                  )}
                                >
                                  {new Date(token.expiresAt) < new Date()
                                    ? 'Expired'
                                    : `Expires ${formatDate(token.expiresAt)}`}
                                </span>
                              )}
                              <span>Used {token.useCount} times</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedToken(token);
                                setShowRevokeDialog(true);
                              }}
                            >
                              <BanIcon className="h-4 w-4 mr-1" />
                              Revoke
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedToken(token);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revoked Tokens */}
              {revokedTokens.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Revoked Tokens</h4>
                  <div className="divide-y divide-border rounded-lg border border-dashed opacity-60">
                    {revokedTokens.map((token) => (
                      <div key={token.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium line-through">{token.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                Revoked
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span>Revoked {formatDate(token.revokedAt)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedToken(token);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Token Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        <DialogHeader onClose={() => setShowCreateDialog(false)}>
          <DialogTitle>Create API Token</DialogTitle>
          <DialogDescription>
            Generate a new API token for programmatic access
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Token Name</label>
              <Input
                placeholder="e.g., CI/CD Pipeline"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Permissions</label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-1"
                  onClick={selectAllScopes}
                >
                  Select All
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {API_TOKEN_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors',
                      formData.scopes.includes(scope)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={formData.scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                    />
                    <div
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center',
                        formData.scopes.includes(scope)
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground'
                      )}
                    >
                      {formData.scopes.includes(scope) && (
                        <CheckIcon className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium block">{SCOPE_DESCRIPTIONS[scope]}</span>
                      <span className="text-xs text-muted-foreground">{scope}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Expiration</label>
              <Select
                value={formData.expiresIn}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, expiresIn: value }))}
                options={EXPIRY_OPTIONS}
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} isLoading={isCreating}>
            Create Token
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Show Token Dialog */}
      <Dialog
        open={showTokenDialog}
        onClose={() => {
          setShowTokenDialog(false);
          setCreatedToken(null);
          setTokenCopied(false);
        }}
        className="max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Token Created</DialogTitle>
          <DialogDescription>
            Copy your token now. You won&apos;t be able to see it again!
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm break-all font-mono">{createdToken?.token}</code>
                <Button variant="ghost" size="sm" onClick={handleCopyToken}>
                  {tokenCopied ? (
                    <CheckIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Name:</strong> {createdToken?.name}
              </p>
              <p>
                <strong>Scopes:</strong> {createdToken?.scopes.join(', ')}
              </p>
              {createdToken?.expiresAt && (
                <p>
                  <strong>Expires:</strong> {formatDate(createdToken.expiresAt)}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            onClick={() => {
              setShowTokenDialog(false);
              setCreatedToken(null);
              setTokenCopied(false);
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        open={showRevokeDialog}
        onClose={() => {
          setShowRevokeDialog(false);
          setSelectedToken(null);
        }}
        onConfirm={handleRevoke}
        title="Revoke Token"
        description={`Are you sure you want to revoke "${selectedToken?.name}"? This action cannot be undone and any applications using this token will lose access.`}
        confirmLabel="Revoke Token"
        variant="destructive"
        isLoading={isRevoking}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedToken(null);
        }}
        onConfirm={handleDelete}
        title="Delete Token"
        description={`Are you sure you want to permanently delete "${selectedToken?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
      />
    </>
  );
}
