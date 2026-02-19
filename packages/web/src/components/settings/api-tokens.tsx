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
import {
  api,
  ApiToken,
  ApiTokenScope,
  API_TOKEN_SCOPES,
  CreateTokenResponse,
  Project,
  PROJECT_ACCESS_ALL,
} from '@/lib/api';
import { cn } from '@/lib/utils';

// ============================================================
// Icons
// ============================================================

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function BanIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

// ============================================================
// Constants
// ============================================================

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'Never' },
];

/** Scope groups for the permissions UI, organized by resource */
interface ScopeGroup {
  label: string;
  description: string;
  scopes: { scope: ApiTokenScope; label: string }[];
}

const SCOPE_GROUPS: ScopeGroup[] = [
  {
    label: 'Projects',
    description: 'Manage projects',
    scopes: [
      { scope: 'projects:read', label: 'View projects' },
      { scope: 'projects:write', label: 'Create, update, delete projects' },
    ],
  },
  {
    label: 'Test Suites',
    description: 'Manage test suites',
    scopes: [
      { scope: 'suites:read', label: 'View suites' },
      { scope: 'suites:write', label: 'Create, update, delete suites' },
    ],
  },
  {
    label: 'Tests',
    description: 'Manage tests',
    scopes: [
      { scope: 'tests:read', label: 'View tests' },
      { scope: 'tests:write', label: 'Create, update, delete tests' },
    ],
  },
  {
    label: 'Recordings',
    description: 'Manage recordings',
    scopes: [
      { scope: 'recordings:read', label: 'View recordings' },
      { scope: 'recordings:write', label: 'Upload, update, delete recordings' },
    ],
  },
  {
    label: 'Runs',
    description: 'Test execution',
    scopes: [
      { scope: 'runs:read', label: 'View run results' },
      { scope: 'runs:execute', label: 'Execute test runs' },
    ],
  },
  {
    label: 'Schedules',
    description: 'Manage scheduled runs',
    scopes: [
      { scope: 'schedules:read', label: 'View schedules' },
      { scope: 'schedules:write', label: 'Create, update, delete schedules' },
    ],
  },
  {
    label: 'Webhooks',
    description: 'Manage webhooks',
    scopes: [
      { scope: 'webhooks:read', label: 'View webhooks' },
      { scope: 'webhooks:write', label: 'Create, update, delete webhooks' },
    ],
  },
];

/** Preset permission sets for quick selection */
const PRESET_OPTIONS = [
  { value: 'custom', label: 'Custom' },
  { value: 'readonly', label: 'Read Only' },
  { value: 'cicd', label: 'CI/CD Pipeline' },
  { value: 'full', label: 'Full Access' },
];

function getPresetScopes(preset: string): ApiTokenScope[] {
  switch (preset) {
    case 'readonly':
      return API_TOKEN_SCOPES.filter((s) => s.endsWith(':read'));
    case 'cicd':
      return ['projects:read', 'tests:read', 'runs:read', 'runs:execute', 'recordings:read'];
    case 'full':
      return [...API_TOKEN_SCOPES];
    default:
      return [];
  }
}

// ============================================================
// Helpers
// ============================================================

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

function formatProjectAccess(projectIds: string[] | undefined, projects: Project[]): string {
  if (!projectIds || projectIds.length === 0) return 'No projects';
  if (projectIds.includes(PROJECT_ACCESS_ALL)) return 'All projects';
  const names = projectIds
    .map((id) => projects.find((p) => p.id === id)?.name)
    .filter(Boolean);
  if (names.length === 0) return `${projectIds.length} project${projectIds.length !== 1 ? 's' : ''}`;
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2} more`;
}

// ============================================================
// Checkbox component (inline)
// ============================================================

function Checkbox({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors',
        checked ? 'bg-primary border-primary' : 'border-muted-foreground hover:border-primary',
        className
      )}
    >
      {checked && <CheckIcon className="h-3 w-3 text-primary-foreground" />}
    </button>
  );
}

// ============================================================
// Form Data
// ============================================================

interface CreateTokenFormData {
  name: string;
  scopes: ApiTokenScope[];
  projectAccess: 'all' | 'specific';
  selectedProjectIds: string[];
  expiresIn: string;
  preset: string;
}

const INITIAL_FORM_DATA: CreateTokenFormData = {
  name: '',
  scopes: [],
  projectAccess: 'all',
  selectedProjectIds: [],
  expiresIn: '30',
  preset: 'custom',
};

// ============================================================
// Main Component
// ============================================================

export function ApiTokensSettings() {
  const { addToast } = useToast();
  const [tokens, setTokens] = React.useState<ApiToken[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRevoking, setIsRevoking] = React.useState(false);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showTokenDialog, setShowTokenDialog] = React.useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState<CreateTokenFormData>(INITIAL_FORM_DATA);

  // Created token (shown once)
  const [createdToken, setCreatedToken] = React.useState<CreateTokenResponse | null>(null);
  const [tokenCopied, setTokenCopied] = React.useState(false);

  // Token to revoke/delete
  const [selectedToken, setSelectedToken] = React.useState<ApiToken | null>(null);

  // ========== Data fetching ==========

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

  const fetchProjects = React.useCallback(async () => {
    try {
      const response = await api.listProjects({ limit: 100 });
      setProjects(response.data);
    } catch {
      // Silently fail - projects list is optional for token display
    }
  }, []);

  React.useEffect(() => {
    fetchTokens();
    fetchProjects();
  }, [fetchTokens, fetchProjects]);

  // ========== Handlers ==========

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      addToast({ type: 'error', title: 'Token name is required' });
      return;
    }
    if (formData.scopes.length === 0) {
      addToast({ type: 'error', title: 'Select at least one permission' });
      return;
    }
    if (formData.projectAccess === 'specific' && formData.selectedProjectIds.length === 0) {
      addToast({ type: 'error', title: 'Select at least one project' });
      return;
    }

    setIsCreating(true);
    try {
      let expiresAt: string | null = null;
      if (formData.expiresIn !== 'never') {
        const days = parseInt(formData.expiresIn, 10);
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiresAt = date.toISOString();
      }

      const projectIds =
        formData.projectAccess === 'all' ? [PROJECT_ACCESS_ALL] : formData.selectedProjectIds;

      const token = await api.createApiToken({
        name: formData.name.trim(),
        scopes: formData.scopes,
        projectIds,
        expiresAt,
      });

      setCreatedToken(token);
      setShowCreateDialog(false);
      setShowTokenDialog(true);
      setFormData(INITIAL_FORM_DATA);
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

  // ========== Scope & form helpers ==========

  const toggleScope = (scope: ApiTokenScope) => {
    setFormData((prev) => ({
      ...prev,
      preset: 'custom',
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const toggleGroupScopes = (group: ScopeGroup) => {
    const groupScopes = group.scopes.map((s) => s.scope);
    const allSelected = groupScopes.every((s) => formData.scopes.includes(s));
    setFormData((prev) => ({
      ...prev,
      preset: 'custom',
      scopes: allSelected
        ? prev.scopes.filter((s) => !groupScopes.includes(s))
        : [...new Set([...prev.scopes, ...groupScopes])],
    }));
  };

  const applyPreset = (preset: string) => {
    const scopes = getPresetScopes(preset);
    setFormData((prev) => ({
      ...prev,
      preset,
      scopes: preset === 'custom' ? prev.scopes : scopes,
    }));
  };

  const toggleProject = (projectId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedProjectIds: prev.selectedProjectIds.includes(projectId)
        ? prev.selectedProjectIds.filter((id) => id !== projectId)
        : [...prev.selectedProjectIds, projectId],
    }));
  };

  const activeTokens = tokens.filter((t) => !t.revokedAt);
  const revokedTokens = tokens.filter((t) => t.revokedAt);

  // ========== Render ==========

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
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Active Tokens ({activeTokens.length})
                  </h4>
                  <div className="divide-y divide-border rounded-lg border">
                    {activeTokens.map((token) => (
                      <TokenCard
                        key={token.id}
                        token={token}
                        projects={projects}
                        onRevoke={() => {
                          setSelectedToken(token);
                          setShowRevokeDialog(true);
                        }}
                        onDelete={() => {
                          setSelectedToken(token);
                          setShowDeleteDialog(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Revoked Tokens */}
              {revokedTokens.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Revoked Tokens ({revokedTokens.length})
                  </h4>
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

      {/* ==================== Create Token Dialog ==================== */}
      <Dialog
        open={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          setFormData(INITIAL_FORM_DATA);
        }}
        className="max-w-2xl"
      >
        <DialogHeader
          onClose={() => {
            setShowCreateDialog(false);
            setFormData(INITIAL_FORM_DATA);
          }}
        >
          <DialogTitle>Create API Token</DialogTitle>
          <DialogDescription>
            Generate a new token with specific permissions and project access
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-6">
            {/* Token Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Token Name</label>
              <Input
                placeholder="e.g., CI/CD Pipeline, Staging Deploy"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Project Access */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Project Access</label>
              <p className="text-xs text-muted-foreground">
                Choose which projects this token can access
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                    formData.projectAccess === 'all'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => setFormData((prev) => ({ ...prev, projectAccess: 'all' }))}
                >
                  <GlobeIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-sm font-medium">All Projects</div>
                    <div className="text-xs text-muted-foreground">
                      Access all current and future projects
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                    formData.projectAccess === 'specific'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => setFormData((prev) => ({ ...prev, projectAccess: 'specific' }))}
                >
                  <FolderIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Specific Projects</div>
                    <div className="text-xs text-muted-foreground">
                      Limit access to selected projects
                    </div>
                  </div>
                </button>
              </div>

              {/* Project Selector */}
              {formData.projectAccess === 'specific' && (
                <div className="space-y-2 pl-1">
                  {projects.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No projects found</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                      {projects.map((project) => (
                        <label
                          key={project.id}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-sm',
                            formData.selectedProjectIds.includes(project.id)
                              ? 'bg-primary/5 text-foreground'
                              : 'hover:bg-muted text-muted-foreground'
                          )}
                        >
                          <Checkbox
                            checked={formData.selectedProjectIds.includes(project.id)}
                            onChange={() => toggleProject(project.id)}
                          />
                          <span className="truncate">
                            {project.color && (
                              <span
                                className="inline-block w-2 h-2 rounded-full mr-1.5"
                                style={{ backgroundColor: project.color }}
                              />
                            )}
                            {project.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Permissions</label>
                  <p className="text-xs text-muted-foreground">
                    {formData.scopes.length} of {API_TOKEN_SCOPES.length} selected
                  </p>
                </div>
                <Select
                  value={formData.preset}
                  onValueChange={applyPreset}
                  options={PRESET_OPTIONS}
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {SCOPE_GROUPS.map((group) => {
                  const groupScopes = group.scopes.map((s) => s.scope);
                  const allSelected = groupScopes.every((s) => formData.scopes.includes(s));
                  const someSelected =
                    !allSelected && groupScopes.some((s) => formData.scopes.includes(s));

                  return (
                    <div
                      key={group.label}
                      className="rounded-lg border overflow-hidden"
                    >
                      {/* Group header */}
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left"
                        onClick={() => toggleGroupScopes(group)}
                      >
                        <div
                          className={cn(
                            'h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors',
                            allSelected
                              ? 'bg-primary border-primary'
                              : someSelected
                                ? 'border-primary bg-primary/30'
                                : 'border-muted-foreground'
                          )}
                        >
                          {allSelected && (
                            <CheckIcon className="h-3 w-3 text-primary-foreground" />
                          )}
                          {someSelected && !allSelected && (
                            <div className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />
                          )}
                        </div>
                        <span className="text-sm font-medium flex-1">{group.label}</span>
                        <span className="text-xs text-muted-foreground">{group.description}</span>
                      </button>

                      {/* Group scopes */}
                      <div className="divide-y divide-border">
                        {group.scopes.map(({ scope, label }) => (
                          <label
                            key={scope}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                              formData.scopes.includes(scope)
                                ? 'bg-primary/5'
                                : 'hover:bg-muted/30'
                            )}
                          >
                            <Checkbox
                              checked={formData.scopes.includes(scope)}
                              onChange={() => toggleScope(scope)}
                            />
                            <span className="text-sm flex-1">{label}</span>
                            <code className="text-xs text-muted-foreground">{scope}</code>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expiration */}
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
          <Button
            variant="outline"
            onClick={() => {
              setShowCreateDialog(false);
              setFormData(INITIAL_FORM_DATA);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} isLoading={isCreating}>
            Create Token
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ==================== Show Token Dialog ==================== */}
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
                <strong>Access:</strong>{' '}
                {createdToken?.projectIds?.includes(PROJECT_ACCESS_ALL)
                  ? 'All projects'
                  : formatProjectAccess(createdToken?.projectIds, projects)}
              </p>
              <p>
                <strong>Permissions:</strong> {createdToken?.scopes.join(', ')}
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

      {/* ===== Revoke Confirmation Dialog ===== */}
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

      {/* ===== Delete Confirmation Dialog ===== */}
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

// ============================================================
// Token Card Component
// ============================================================

function TokenCard({
  token,
  projects,
  onRevoke,
  onDelete,
}: {
  token: ApiToken;
  projects: Project[];
  onRevoke: () => void;
  onDelete: () => void;
}) {
  // Group scopes by resource for display
  const scopesByResource = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const scope of token.scopes) {
      const [resource, action] = scope.split(':');
      if (!map.has(resource)) map.set(resource, []);
      map.get(resource)!.push(action);
    }
    return map;
  }, [token.scopes]);

  const isExpired = token.expiresAt ? new Date(token.expiresAt) < new Date() : false;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          {/* Name + prefix */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{token.name}</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {token.tokenPrefix}...{token.tokenSuffix}
            </code>
            {isExpired && (
              <Badge variant="secondary" className="text-xs text-destructive border-destructive/30">
                Expired
              </Badge>
            )}
          </div>

          {/* Project access */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {token.projectIds?.includes(PROJECT_ACCESS_ALL) ? (
              <>
                <GlobeIcon className="h-3 w-3" />
                <span>All projects</span>
              </>
            ) : (
              <>
                <FolderIcon className="h-3 w-3" />
                <span>{formatProjectAccess(token.projectIds, projects)}</span>
              </>
            )}
          </div>

          {/* Scopes - compact display grouped by resource */}
          <div className="flex flex-wrap gap-1">
            {Array.from(scopesByResource.entries()).map(([resource, actions]) => (
              <Badge key={resource} variant="secondary" className="text-xs">
                {resource}: {actions.join(', ')}
              </Badge>
            ))}
          </div>

          {/* Meta info */}
          <div className="text-xs text-muted-foreground space-x-3">
            <span>Created {formatDate(token.createdAt)}</span>
            <span>Last used {formatRelativeTime(token.lastUsedAt)}</span>
            {token.expiresAt && !isExpired && (
              <span>Expires {formatDate(token.expiresAt)}</span>
            )}
            <span>Used {token.useCount}×</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onRevoke}>
            <BanIcon className="h-4 w-4 mr-1" />
            Revoke
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
