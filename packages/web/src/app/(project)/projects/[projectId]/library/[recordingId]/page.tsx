'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import {
  ArrowLeft,
  Globe,
  Monitor,
  Calendar,
  Clock,
  HardDrive,
  Tag,
  MousePointer2,
  Keyboard,
  Navigation,
  ArrowUpDown,
  Hand,
  ChevronDown,
  KeyRound,
  Send,
  CheckCircle2,
  Layout,
  ExternalLink,
  Pencil,
  Trash2,
  Play,
  TestTube2,
  FileJson,
  Copy,
  Check,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { api, type Recording, type Run, type Test } from '@/lib/api';

// ─── Action Type Helpers ─────────────────────────────────────

type ActionTypeKey =
  | 'click'
  | 'input'
  | 'navigation'
  | 'scroll'
  | 'hover'
  | 'select'
  | 'keypress'
  | 'submit'
  | 'checkpoint'
  | 'modal-lifecycle';

const ACTION_TYPE_CONFIG: Record<
  ActionTypeKey,
  { icon: React.ComponentType<{ className?: string }>; label: string; color: string }
> = {
  click: { icon: MousePointer2, label: 'Click', color: 'text-blue-500' },
  input: { icon: Keyboard, label: 'Input', color: 'text-green-500' },
  navigation: { icon: Navigation, label: 'Navigation', color: 'text-purple-500' },
  scroll: { icon: ArrowUpDown, label: 'Scroll', color: 'text-orange-500' },
  hover: { icon: Hand, label: 'Hover', color: 'text-yellow-500' },
  select: { icon: ChevronDown, label: 'Select', color: 'text-teal-500' },
  keypress: { icon: KeyRound, label: 'Keypress', color: 'text-pink-500' },
  submit: { icon: Send, label: 'Submit', color: 'text-indigo-500' },
  checkpoint: { icon: CheckCircle2, label: 'Checkpoint', color: 'text-emerald-500' },
  'modal-lifecycle': { icon: Layout, label: 'Modal', color: 'text-slate-500' },
};

function getActionDescription(action: Record<string, unknown>): string {
  const type = action.type as string;
  switch (type) {
    case 'click': {
      const text = action.text as string | undefined;
      const tagName = action.tagName as string | undefined;
      return text ? `Click "${text.slice(0, 50)}"` : `Click <${tagName || 'element'}>`;
    }
    case 'input': {
      const isSensitive = action.isSensitive as boolean | undefined;
      const value = action.value as string | undefined;
      const inputType = action.inputType as string | undefined;
      if (isSensitive) return `Type ••••••• into ${inputType || 'field'}`;
      return `Type "${(value || '').slice(0, 40)}"`;
    }
    case 'navigation': {
      const to = action.to as string | undefined;
      if (to) {
        try {
          const url = new URL(to);
          return `Navigate to ${url.pathname}`;
        } catch {
          return `Navigate to ${to.slice(0, 60)}`;
        }
      }
      return 'Navigate';
    }
    case 'scroll': {
      const scrollY = action.scrollY as number | undefined;
      return `Scroll to y=${scrollY ?? 0}`;
    }
    case 'hover': {
      const text = action.text as string | undefined;
      return text ? `Hover "${text.slice(0, 50)}"` : 'Hover element';
    }
    case 'select': {
      const selectedText = action.selectedText as string | undefined;
      return selectedText ? `Select "${selectedText.slice(0, 50)}"` : 'Select option';
    }
    case 'keypress': {
      const key = action.key as string | undefined;
      const modifiers = action.modifiers as string[] | undefined;
      const combo = modifiers?.length ? `${modifiers.join('+')}+${key}` : key;
      return `Press ${combo || 'key'}`;
    }
    case 'submit':
      return 'Submit form';
    case 'checkpoint': {
      const checkType = action.checkType as string | undefined;
      const passed = action.passed as boolean | undefined;
      return `Checkpoint: ${checkType || 'validation'} ${passed ? '✓' : '✗'}`;
    }
    case 'modal-lifecycle': {
      const event = action.event as string | undefined;
      return `Modal ${event || 'event'}`;
    }
    default:
      return type;
  }
}

function getActionSelector(action: Record<string, unknown>): string | null {
  const selector = action.selector as Record<string, unknown> | undefined;
  if (!selector) return null;
  const strategies = ['id', 'dataTestId', 'ariaLabel', 'name', 'css', 'xpath'] as const;
  for (const strategy of strategies) {
    if (selector[strategy]) return `${strategy}: ${selector[strategy]}`;
  }
  return null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Loading Skeleton ────────────────────────────────────────

function RecordingDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

// ─── Metadata Row ────────────────────────────────────────────

function MetaItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1 break-all"
          >
            {value}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm font-medium break-all">{value}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function RecordingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const recordingId = params.recordingId as string;

  const [recording, setRecording] = React.useState<Recording | null>(null);
  const [linkedTests, setLinkedTests] = React.useState<Test[]>([]);
  const [recentRuns, setRecentRuns] = React.useState<Run[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState('actions');
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Fetch all data
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const rec = await api.getRecording(recordingId);
      setRecording(rec);

      // Fetch linked tests (tests that use this recording) and recent runs in parallel
      const [testsRes, runsRes] = await Promise.all([
        api.listTests(projectId, { limit: 100 }).catch(() => ({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } })),
        api.listRuns({ projectId, recordingId, limit: 10 }).catch(() => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })),
      ]);

      // Filter tests that use this recording
      const linked = testsRes.data.filter(
        (t: Test) => t.recordingId === recordingId
      );
      setLinkedTests(linked);
      setRecentRuns(runsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recording');
    } finally {
      setLoading(false);
    }
  }, [projectId, recordingId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.deleteRecording(recordingId);
      router.push(`/projects/${projectId}/library`);
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // Copy JSON
  const handleCopyJson = async () => {
    if (!recording) return;
    await navigator.clipboard.writeText(JSON.stringify(recording.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Derived data — before any early returns (Rules of Hooks)
  const actions = React.useMemo(() => {
    if (!recording?.data?.actions) return [];
    return recording.data.actions as Record<string, unknown>[];
  }, [recording]);

  const actionTypeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const action of actions) {
      const type = action.type as string;
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }, [actions]);

  const firstTimestamp = React.useMemo(() => {
    if (actions.length === 0) return 0;
    return (actions[0].timestamp as number) || 0;
  }, [actions]);

  // ─── Loading State ─────────────────────────────────────────

  if (loading) return <RecordingDetailSkeleton />;

  // ─── Error State ───────────────────────────────────────────

  if (error || !recording) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/library`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Recording Not Found</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium">Failed to load recording</p>
            <p className="text-muted-foreground mt-1">{error || 'Recording not found'}</p>
            <Button className="mt-4" onClick={() => fetchData()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="mt-1" asChild>
            <Link href={`/projects/${projectId}/library`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{recording.name}</h1>
            {recording.description && (
              <p className="text-muted-foreground">{recording.description}</p>
            )}
            {recording.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recording.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/projects/${projectId}/tests/new-from-recording?recordingId=${recordingId}`)
            }
          >
            <TestTube2 className="h-4 w-4 mr-1.5" />
            Create Test
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: Edit dialog
            }}
          >
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Play className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recording.actionCount}</p>
                <p className="text-xs text-muted-foreground">Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {recording.estimatedDurationMs
                    ? formatDuration(recording.estimatedDurationMs)
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Est. Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <TestTube2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedTests.length}</p>
                <p className="text-xs text-muted-foreground">Linked Tests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <HardDrive className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {recording.dataSizeBytes ? formatBytes(recording.dataSizeBytes) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">File Size</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recording Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            <MetaItem
              icon={Globe}
              label="Starting URL"
              value={recording.url || recording.data.url}
              href={recording.url || recording.data.url}
            />
            <MetaItem
              icon={Monitor}
              label="Viewport"
              value={
                recording.data.viewport
                  ? `${recording.data.viewport.width} × ${recording.data.viewport.height}`
                  : '—'
              }
            />
            <MetaItem
              icon={Calendar}
              label="Recorded"
              value={
                recording.data.startTime
                  ? formatDate(recording.data.startTime)
                  : formatDate(recording.createdAt)
              }
            />
            <MetaItem
              icon={Calendar}
              label="Uploaded"
              value={formatDate(recording.createdAt)}
            />
            <MetaItem
              icon={FileJson}
              label="Schema Version"
              value={recording.schemaVersion || recording.data.version || '—'}
            />
            <MetaItem
              icon={HardDrive}
              label="Original ID"
              value={recording.originalId}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Actions / Linked Tests / Run History / Raw JSON */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="actions">
            Actions ({actions.length})
          </TabsTrigger>
          <TabsTrigger value="tests">
            Linked Tests ({linkedTests.length})
          </TabsTrigger>
          <TabsTrigger value="runs">
            Run History ({recentRuns.length})
          </TabsTrigger>
          <TabsTrigger value="json">
            Raw JSON
          </TabsTrigger>
        </TabsList>

        {/* Actions Tab */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Action Timeline</CardTitle>
                  <CardDescription>
                    Step-by-step recording of {actions.length} browser interactions
                  </CardDescription>
                </div>
                {/* Action type breakdown */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(actionTypeCounts).map(([type, count]) => {
                    const config = ACTION_TYPE_CONFIG[type as ActionTypeKey];
                    if (!config) return null;
                    return (
                      <Badge key={type} variant="outline" className="text-xs font-normal">
                        {config.label}: {count}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No actions recorded
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 pr-4 font-medium text-muted-foreground w-12">#</th>
                        <th className="pb-3 pr-4 font-medium text-muted-foreground w-28">Type</th>
                        <th className="pb-3 pr-4 font-medium text-muted-foreground">Description</th>
                        <th className="pb-3 pr-4 font-medium text-muted-foreground hidden lg:table-cell">Selector</th>
                        <th className="pb-3 font-medium text-muted-foreground w-20 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map((action, index) => {
                        const type = action.type as ActionTypeKey;
                        const config = ACTION_TYPE_CONFIG[type] || {
                          icon: MousePointer2,
                          label: type,
                          color: 'text-muted-foreground',
                        };
                        const Icon = config.icon;
                        const selector = getActionSelector(action);
                        const timestamp = (action.timestamp as number) || 0;
                        const relativeMs = timestamp - firstTimestamp;

                        return (
                          <tr
                            key={(action.id as string) || index}
                            className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">
                              {index + 1}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${config.color}`} />
                                <span className="font-medium">{config.label}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-foreground">
                                {getActionDescription(action)}
                              </span>
                            </td>
                            <td className="py-3 pr-4 hidden lg:table-cell">
                              {selector ? (
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground max-w-[300px] inline-block truncate">
                                  {selector}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 text-right text-muted-foreground text-xs font-mono">
                              {relativeMs > 0 ? `+${formatDuration(relativeMs)}` : '0ms'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linked Tests Tab */}
        <TabsContent value="tests">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked Tests</CardTitle>
              <CardDescription>
                Tests that use this recording
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkedTests.length === 0 ? (
                <div className="text-center py-8">
                  <TestTube2 className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No tests use this recording yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      router.push(
                        `/projects/${projectId}/tests/new-from-recording?recordingId=${recordingId}`
                      )
                    }
                  >
                    <TestTube2 className="h-4 w-4 mr-1.5" />
                    Create Test from Recording
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {linkedTests.map((test) => (
                    <Link
                      key={test.id}
                      href={`/projects/${projectId}/suites/${test.suiteId}/tests/${test.id}`}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <TestTube2 className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{test.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{test.browsers.length} browser{test.browsers.length !== 1 ? 's' : ''}</span>
                            <span>·</span>
                            <span>{test.status}</span>
                            {test.lastRunStatus && (
                              <>
                                <span>·</span>
                                <span>Last run: {test.lastRunStatus}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Run History Tab */}
        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run History</CardTitle>
              <CardDescription>
                Recent test runs using this recording
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <div className="text-center py-8">
                  <Play className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No runs found for this recording</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRuns.map((run) => (
                    <Link
                      key={run.id}
                      href={`/projects/${projectId}/runs/${run.id}`}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RunStatusBadge status={run.status} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {run.testName || run.recordingName || `Run ${run.id.slice(0, 8)}`}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="capitalize">{run.browser}</span>
                            {run.durationMs != null && (
                              <>
                                <span>·</span>
                                <span>{formatDuration(run.durationMs)}</span>
                              </>
                            )}
                            {run.duration != null && run.durationMs == null && (
                              <>
                                <span>·</span>
                                <span>{formatDuration(run.duration)}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>{formatDate(run.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw JSON Tab */}
        <TabsContent value="json">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Raw Recording Data</CardTitle>
                  <CardDescription>
                    The original JSON recording data
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyJson}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1.5" />
                      Copy JSON
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto max-h-[600px] rounded-lg bg-muted p-4 text-xs font-mono leading-relaxed">
                {JSON.stringify(recording.data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Recording"
        description="Are you sure you want to delete this recording? This action cannot be undone. Tests using this recording will not be affected."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleting}
      />
    </div>
  );
}
