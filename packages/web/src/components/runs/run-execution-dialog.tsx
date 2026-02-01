'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api, type Run, ApiClientError } from '@/lib/api';
import { useToast } from '@/components/providers/toast-provider';
import { cn, formatDuration } from '@/lib/utils';

// SSE Event Types (matching API)
interface RunStartedEvent {
  type: 'run:started';
  runId: string;
  timestamp: string;
  recordingId: string;
  recordingName: string;
  totalActions: number;
  browser: string;
}

interface ActionStartedEvent {
  type: 'action:started';
  runId: string;
  timestamp: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  totalActions: number;
}

interface ActionSuccessEvent {
  type: 'action:success';
  runId: string;
  timestamp: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  totalActions: number;
  durationMs: number;
  selectorUsed?: string;
}

interface ActionFailedEvent {
  type: 'action:failed';
  runId: string;
  timestamp: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  totalActions: number;
  errorMessage: string;
  durationMs: number;
}

interface ActionSkippedEvent {
  type: 'action:skipped';
  runId: string;
  timestamp: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  totalActions: number;
  reason: string;
}

interface RunCompletedEvent {
  type: 'run:completed';
  runId: string;
  timestamp: string;
  status: 'passed' | 'failed' | 'cancelled';
  durationMs: number;
  actionsExecuted: number;
  actionsFailed: number;
  actionsSkipped: number;
  videoPath?: string;
}

interface RunErrorEvent {
  type: 'run:error';
  runId: string;
  timestamp: string;
  errorMessage: string;
}

type RunProgressEvent =
  | RunStartedEvent
  | ActionStartedEvent
  | ActionSuccessEvent
  | ActionFailedEvent
  | ActionSkippedEvent
  | RunCompletedEvent
  | RunErrorEvent;

// Action log entry
interface ActionLogEntry {
  actionId: string;
  actionType: string;
  actionIndex: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  durationMs?: number;
  errorMessage?: string;
  selectorUsed?: string;
  timestamp: string;
}

// Icons
function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3.14.69 4.22 1.78L12 12l-4.22-5.22C8.86 5.69 10.34 5 12 5zm-7 7c0-1.85.63-3.55 1.69-4.9L12 12l-4.31 4.31C6.63 15.55 5 13.85 5 12zm7 7c-1.66 0-3.14-.69-4.22-1.78L12 12l4.22 5.22C15.14 18.31 13.66 19 12 19zm5.31-2.69L12 12l5.31-4.31C18.37 8.45 19 10.15 19 12s-.63 3.55-1.69 4.31z"/>
    </svg>
  );
}

function FirefoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      <circle cx="12" cy="12" r="5"/>
    </svg>
  );
}

function SafariIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      <path d="M12 7l2 5-5 2 3-7z"/>
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
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
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
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
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
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
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
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
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
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
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>
  );
}

function SkipIcon({ className }: { className?: string }) {
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
      <path d="M5 5v14l11-7z" />
      <line x1="19" x2="19" y1="5" y2="19" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
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
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// Browser option card
function BrowserOption({
  browser,
  icon: Icon,
  selected,
  onClick,
}: {
  browser: string;
  icon: React.ComponentType<{ className?: string }>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-secondary/50'
      )}
    >
      <Icon className={cn('h-8 w-8 mb-2', selected ? 'text-primary' : 'text-muted-foreground')} />
      <span className={cn('text-sm font-medium capitalize', selected && 'text-primary')}>
        {browser}
      </span>
    </button>
  );
}

// Toggle switch component
function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all text-left w-full',
        checked
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-secondary/50'
      )}
    >
      <Icon className={cn('h-5 w-5 mt-0.5', checked ? 'text-primary' : 'text-muted-foreground')} />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className={cn('text-sm font-medium', checked && 'text-primary')}>{label}</span>
          <div
            className={cn(
              'w-10 h-6 rounded-full transition-colors relative',
              checked ? 'bg-primary' : 'bg-secondary'
            )}
          >
            <div
              className={cn(
                'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow',
                checked ? 'translate-x-5' : 'translate-x-1'
              )}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// Action log item component
function ActionLogItem({ entry }: { entry: ActionLogEntry }) {
  const statusIcons = {
    pending: <ClockIcon className="h-4 w-4 text-muted-foreground/40" />,
    running: <LoaderIcon className="h-4 w-4 text-primary animate-spin" />,
    success: <CheckCircleIcon className="h-4 w-4 text-success" />,
    failed: <XCircleIcon className="h-4 w-4 text-destructive" />,
    skipped: <SkipIcon className="h-4 w-4 text-warning" />,
  };

  const statusColors = {
    pending: 'text-muted-foreground/40',
    running: 'text-primary',
    success: 'text-success',
    failed: 'text-destructive',
    skipped: 'text-warning',
  };

  // Pending actions are dimmed and show just the number
  const isPending = entry.status === 'pending';

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-md text-sm transition-all',
        entry.status === 'running' && 'bg-primary/10 border border-primary/20',
        entry.status === 'failed' && 'bg-destructive/5',
        entry.status === 'success' && 'bg-success/5',
        isPending && 'opacity-40'
      )}
    >
      {statusIcons[entry.status]}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium', isPending && 'text-muted-foreground')}>
            {entry.actionIndex + 1}. {isPending ? 'Pending...' : entry.actionType}
          </span>
          {entry.selectorUsed && !isPending && (
            <Badge variant="secondary" className="text-xs">
              {entry.selectorUsed}
            </Badge>
          )}
        </div>
        {entry.errorMessage && (
          <p className="text-xs text-destructive truncate mt-0.5">{entry.errorMessage}</p>
        )}
      </div>
      {entry.durationMs !== undefined && entry.status !== 'pending' && entry.status !== 'running' && (
        <span className={cn('text-xs', statusColors[entry.status])}>
          {formatDuration(entry.durationMs)}
        </span>
      )}
    </div>
  );
}

// Minimal recording info needed for the dialog
interface RecordingInfo {
  id: string;
  name: string;
  url: string;
  actionCount: number;
}

interface RunExecutionDialogProps {
  recording: RecordingInfo | null;
  open: boolean;
  onClose: () => void;
  onComplete?: (run: Run) => void;
}

export function RunExecutionDialog({
  recording,
  open,
  onClose,
  onComplete,
}: RunExecutionDialogProps) {
  const { success, error: toastError } = useToast();
  
  // Configuration state
  const [browser, setBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [headless, setHeadless] = useState(true);
  const [recordVideo, setRecordVideo] = useState(false);

  // Execution state
  const [phase, setPhase] = useState<'config' | 'running' | 'completed'>('config');
  const [runId, setRunId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [totalActions, setTotalActions] = useState(0);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [finalStatus, setFinalStatus] = useState<'passed' | 'failed' | 'cancelled' | null>(null);
  const [finalDuration, setFinalDuration] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('config');
      setRunId(null);
      setIsStarting(false);
      setTotalActions(0);
      setActionLog([]);
      setFinalStatus(null);
      setFinalDuration(null);
      setErrorMessage(null);
    }
  }, [open]);

  // Auto-scroll to keep current running action in view
  useEffect(() => {
    if (logContainerRef.current) {
      // Find the currently running action or the last completed one
      const runningIndex = actionLog.findIndex((a) => a.status === 'running');
      const lastCompletedIndex = actionLog.reduce(
        (lastIdx, a, idx) => (a.status !== 'pending' ? idx : lastIdx),
        -1
      );
      const targetIndex = runningIndex >= 0 ? runningIndex : lastCompletedIndex;
      
      if (targetIndex >= 0) {
        // Each action item is roughly 40px tall
        const itemHeight = 40;
        const containerHeight = logContainerRef.current.clientHeight;
        const targetScrollTop = Math.max(0, (targetIndex * itemHeight) - (containerHeight / 2) + itemHeight);
        
        logContainerRef.current.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      }
    }
  }, [actionLog]);

  // Cleanup SSE on unmount or close
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleStartRun = async () => {
    if (!recording) return;

    setIsStarting(true);
    setErrorMessage(null);

    try {
      // Create the run
      const run = await api.createRun({
        recordingId: recording.id,
        browser,
        headless,
        videoEnabled: recordVideo,
      });

      setRunId(run.id);
      setPhase('running');

      // Connect to SSE for progress updates
      connectToSSE(run.id);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to start run';
      setErrorMessage(msg);
      toastError('Failed to start run', msg);
    } finally {
      setIsStarting(false);
    }
  };

  const connectToSSE = useCallback((id: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = api.getAccessToken();
    
    // Use native EventSource with auth via URL parameter (or use fetch-based SSE)
    // For simplicity, we'll use fetch-based SSE since EventSource doesn't support headers
    const url = `${apiUrl}/api/v1/runs/${id}/progress/stream`;
    
    const fetchSSE = async () => {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`SSE connection failed: ${response.status} - ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              eventData = line.slice(5).trim();
            } else if (line === '' && eventType && eventData) {
              // Process event
              try {
                const event = JSON.parse(eventData) as RunProgressEvent;
                handleSSEEvent(event);
              } catch {
                // Ignore parse errors
              }
              eventType = '';
              eventData = '';
            }
          }
        }
      } catch (err) {
        console.error('SSE error:', err);
        // Don't show error if run already completed
        if (phase === 'running') {
          setErrorMessage(err instanceof Error ? err.message : 'Connection lost');
        }
      }
    };

    fetchSSE();
  }, [phase]);

  const handleSSEEvent = useCallback((event: RunProgressEvent) => {
    switch (event.type) {
      case 'run:started':
        setTotalActions(event.totalActions);
        // Initialize action log with pending entries
        const initialLog: ActionLogEntry[] = Array.from({ length: event.totalActions }, (_, i) => ({
          actionId: `pending-${i}`,
          actionType: 'Unknown',
          actionIndex: i,
          status: 'pending',
          timestamp: new Date().toISOString(),
        }));
        setActionLog(initialLog);
        break;

      case 'action:started':
        // Update totalActions if we missed run:started
        if (event.totalActions) {
          setTotalActions((prev) => prev || event.totalActions);
        }
        setActionLog((prev) => {
          // If action log is empty or too small, initialize it
          if (prev.length < (event.totalActions || event.actionIndex + 1)) {
            const newLog: ActionLogEntry[] = Array.from(
              { length: event.totalActions || event.actionIndex + 1 },
              (_, i) => ({
                actionId: `pending-${i}`,
                actionType: 'Unknown',
                actionIndex: i,
                status: 'pending',
                timestamp: new Date().toISOString(),
              })
            );
            // Update the current action
            newLog[event.actionIndex] = {
              actionId: event.actionId,
              actionType: event.actionType,
              actionIndex: event.actionIndex,
              status: 'running',
              timestamp: event.timestamp,
            };
            return newLog;
          }
          
          const updated = [...prev];
          const idx = updated.findIndex((a) => a.actionIndex === event.actionIndex);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              actionId: event.actionId,
              actionType: event.actionType,
              status: 'running',
              timestamp: event.timestamp,
            };
          }
          return updated;
        });
        break;

      case 'action:success':
        // Update totalActions if we missed run:started
        if (event.totalActions) {
          setTotalActions((prev) => prev || event.totalActions);
        }
        setActionLog((prev) => {
          // If action log is empty or too small, initialize it
          if (prev.length < (event.totalActions || event.actionIndex + 1)) {
            const newLog: ActionLogEntry[] = Array.from(
              { length: event.totalActions || event.actionIndex + 1 },
              (_, i) => ({
                actionId: `pending-${i}`,
                actionType: 'Unknown',
                actionIndex: i,
                status: i < event.actionIndex ? 'success' : 'pending',
                timestamp: new Date().toISOString(),
              })
            );
            // Update the current action
            newLog[event.actionIndex] = {
              actionId: event.actionId,
              actionType: event.actionType,
              actionIndex: event.actionIndex,
              status: 'success',
              durationMs: event.durationMs,
              selectorUsed: event.selectorUsed,
              timestamp: event.timestamp,
            };
            return newLog;
          }
          
          const updated = [...prev];
          const idx = updated.findIndex((a) => a.actionIndex === event.actionIndex);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              actionId: event.actionId,
              actionType: event.actionType,
              status: 'success',
              durationMs: event.durationMs,
              selectorUsed: event.selectorUsed,
              timestamp: event.timestamp,
            };
          }
          return updated;
        });
        break;

      case 'action:failed':
        setActionLog((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((a) => a.actionIndex === event.actionIndex);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              actionId: event.actionId,
              actionType: event.actionType,
              status: 'failed',
              durationMs: event.durationMs,
              errorMessage: event.errorMessage,
              timestamp: event.timestamp,
            };
          }
          return updated;
        });
        break;

      case 'action:skipped':
        setActionLog((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((a) => a.actionIndex === event.actionIndex);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              actionId: event.actionId,
              actionType: event.actionType,
              status: 'skipped',
              errorMessage: event.reason,
              timestamp: event.timestamp,
            };
          }
          return updated;
        });
        break;

      case 'run:completed':
        setPhase('completed');
        setFinalStatus(event.status);
        setFinalDuration(event.durationMs);
        if (event.status === 'passed') {
          success('Test Passed', `All ${event.actionsExecuted} actions completed successfully`);
        } else if (event.status === 'failed') {
          toastError('Test Failed', `${event.actionsFailed} action(s) failed`);
        }
        break;

      case 'run:error':
        setPhase('completed');
        setFinalStatus('failed');
        setErrorMessage(event.errorMessage);
        toastError('Test Error', event.errorMessage);
        break;
    }
  }, [success, toastError]);

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    onClose();
    if (phase === 'completed' && runId) {
      onComplete?.({
        id: runId,
        status: finalStatus || 'failed',
        browser,
        headless,
      } as Run);
    }
  };

  const handleViewResults = () => {
    if (runId) {
      window.location.href = `/runs/${runId}`;
    }
  };

  // Calculate progress
  const completedActions = actionLog.filter(
    (a) => a.status === 'success' || a.status === 'failed' || a.status === 'skipped'
  ).length;
  const progress = totalActions > 0 ? (completedActions / totalActions) * 100 : 0;

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-lg">
      <DialogHeader onClose={handleClose}>
        <DialogTitle>
          {phase === 'config' && 'Run Test'}
          {phase === 'running' && 'Running Test...'}
          {phase === 'completed' && (finalStatus === 'passed' ? 'Test Passed!' : 'Test Failed')}
        </DialogTitle>
        <DialogDescription>
          {phase === 'config' && recording?.name}
          {phase === 'running' && `Executing ${recording?.name}`}
          {phase === 'completed' &&
            (finalStatus === 'passed'
              ? `Completed in ${finalDuration ? formatDuration(finalDuration) : '-'}`
              : errorMessage || 'Test execution failed')}
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        {phase === 'config' && (
          <div className="space-y-6">
            {/* Browser Selection */}
            <div className="space-y-2">
              <Label>Browser</Label>
              <div className="grid grid-cols-3 gap-3">
                <BrowserOption
                  browser="chromium"
                  icon={ChromeIcon}
                  selected={browser === 'chromium'}
                  onClick={() => setBrowser('chromium')}
                />
                <BrowserOption
                  browser="firefox"
                  icon={FirefoxIcon}
                  selected={browser === 'firefox'}
                  onClick={() => setBrowser('firefox')}
                />
                <BrowserOption
                  browser="webkit"
                  icon={SafariIcon}
                  selected={browser === 'webkit'}
                  onClick={() => setBrowser('webkit')}
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <Label>Options</Label>
              <ToggleSwitch
                checked={recordVideo}
                onChange={setRecordVideo}
                label="Record Video"
                description="Capture video of the test execution"
                icon={VideoIcon}
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {(phase === 'running' || phase === 'completed') && (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {completedActions}/{totalActions} actions
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    finalStatus === 'passed'
                      ? 'bg-success'
                      : finalStatus === 'failed'
                      ? 'bg-destructive'
                      : 'bg-primary'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Action Log */}
            <div className="space-y-2">
              <Label>Action Log</Label>
              <div
                ref={logContainerRef}
                className="h-64 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-1"
              >
                {actionLog.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                    Waiting for actions...
                  </div>
                ) : (
                  actionLog.map((entry) => (
                    <ActionLogItem key={`${entry.actionIndex}-${entry.status}`} entry={entry} />
                  ))
                )}
              </div>
            </div>

            {/* Summary */}
            {phase === 'completed' && (
              <div className="flex items-center gap-4 p-3 rounded-md bg-secondary/50">
                {finalStatus === 'passed' ? (
                  <CheckCircleIcon className="h-8 w-8 text-success" />
                ) : (
                  <XCircleIcon className="h-8 w-8 text-destructive" />
                )}
                <div>
                  <div className="font-medium">
                    {finalStatus === 'passed' ? 'All tests passed' : 'Test failed'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {finalDuration ? `Duration: ${formatDuration(finalDuration)}` : ''}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        {phase === 'config' && (
          <>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleStartRun} isLoading={isStarting}>
              Start Test
            </Button>
          </>
        )}
        {phase === 'running' && (
          <Button variant="outline" onClick={handleClose}>
            Run in Background
          </Button>
        )}
        {phase === 'completed' && (
          <>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button onClick={handleViewResults}>View Results</Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
