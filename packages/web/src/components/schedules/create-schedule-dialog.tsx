'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/providers/toast-provider';
import { useActiveProject } from '@/components/providers/project-provider';
import { api, type Schedule, type RecordingListItem, type PaginatedResponse, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';

// Icons
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

function InfoIcon({ className }: { className?: string }) {
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
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
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

function CameraIcon({ className }: { className?: string }) {
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
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

// Predefined cron presets
const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Daily at 6 PM', value: '0 18 * * *' },
  { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Weekly on Monday', value: '0 0 * * 1' },
  { label: 'Monthly on the 1st', value: '0 0 1 * *' },
  { label: 'Custom', value: 'custom' },
];

// Common timezones
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

// Screenshot mode type
type ScreenshotMode = 'on-failure' | 'always' | 'never';

// Reusable toggle switch component
function ToggleSwitch({
  id,
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon}
        <div className="space-y-0.5">
          <Label htmlFor={id}>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
      </label>
    </div>
  );
}

// Screenshot mode selector component
function ScreenshotModeSelector({
  value,
  onChange,
}: {
  value: ScreenshotMode;
  onChange: (mode: ScreenshotMode) => void;
}) {
  const modes: { value: ScreenshotMode; label: string; description: string }[] = [
    { value: 'on-failure', label: 'On Failure', description: 'Capture when action fails' },
    { value: 'always', label: 'Always', description: 'Capture for every action' },
    { value: 'never', label: 'Never', description: 'No screenshots' },
  ];

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
      <CameraIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
      <div className="flex-1">
        <span className="text-sm font-medium">Screenshots</span>
        <div className="flex gap-2 mt-2">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              className={cn(
                'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                value === mode.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
              )}
              title={mode.description}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {modes.find((m) => m.value === value)?.description}
        </p>
      </div>
    </div>
  );
}

interface CreateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (schedule: Schedule) => void;
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateScheduleDialogProps) {
  const handleClose = () => onOpenChange(false);
  const { success, error: toastError } = useToast();
  const activeProject = useActiveProject();

  // Form state
  const [name, setName] = useState('');
  const [recordingId, setRecordingId] = useState('');
  const [cronPreset, setCronPreset] = useState('0 0 * * *');
  const [customCron, setCustomCron] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [browser, setBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [recordVideo, setRecordVideo] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState<ScreenshotMode>('on-failure');

  // Loading states
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [recordingsError, setRecordingsError] = useState<string | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load recordings when dialog opens
  useEffect(() => {
    if (open && activeProject) {
      loadRecordings();
    }
  }, [open, activeProject]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setRecordingId('');
      setCronPreset('0 0 * * *');
      setCustomCron('');
      setTimezone('UTC');
      setBrowser('chromium');
      setRecordVideo(false);
      setScreenshotMode('on-failure');
      setErrors({});
    }
  }, [open]);

  const loadRecordings = async () => {
    if (!activeProject) {
      setRecordings([]);
      return;
    }

    setIsLoadingRecordings(true);
    setRecordingsError(null);
    try {
      const response: PaginatedResponse<RecordingListItem> = await api.listRecordings({ 
        projectId: activeProject.id,
        limit: 100 
      });
      setRecordings(response.data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setRecordingsError(err.message);
      } else {
        setRecordingsError('Failed to load recordings');
      }
    } finally {
      setIsLoadingRecordings(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Schedule name is required';
    }

    if (!recordingId) {
      newErrors.recordingId = 'Please select a recording';
    }

    const cronValue = cronPreset === 'custom' ? customCron : cronPreset;
    if (!cronValue.trim()) {
      newErrors.cron = 'Cron expression is required';
    } else {
      // Basic cron validation (5 fields)
      const parts = cronValue.trim().split(/\s+/);
      if (parts.length !== 5) {
        newErrors.cron = 'Invalid cron expression (must have 5 fields)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!activeProject) {
      toastError('No project selected. Please select a project first.');
      return;
    }

    const cronExpression = cronPreset === 'custom' ? customCron.trim() : cronPreset;

    setIsSubmitting(true);
    try {
      const schedule = await api.createSchedule({
        projectId: activeProject.id,
        recordingId,
        name: name.trim(),
        cronExpression,
        timezone,
        browser,
        recordVideo,
        screenshotMode,
      });

      success('Schedule created successfully');
      onSuccess(schedule);
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to create schedule. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} className="sm:max-w-[550px]">
      <DialogHeader onClose={handleClose}>
        <DialogTitle>Create Schedule</DialogTitle>
        <DialogDescription>
          Set up an automated schedule to run your tests at specified intervals.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-4">
            {/* Schedule Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Schedule Name</Label>
              <Input
                id="name"
                placeholder="e.g., Daily Login Test"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Recording Selection */}
            <div className="space-y-2">
              <Label htmlFor="recording">Recording</Label>
              {isLoadingRecordings ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  Loading recordings...
                </div>
              ) : recordingsError ? (
                <div className="text-sm text-destructive">{recordingsError}</div>
              ) : (
                <select
                  id="recording"
                  value={recordingId}
                  onChange={(e) => setRecordingId(e.target.value)}
                  className={`w-full h-10 rounded-md border ${
                    errors.recordingId ? 'border-destructive' : 'border-input'
                  } bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                >
                  <option value="">Select a recording...</option>
                  {recordings.map((recording) => (
                    <option key={recording.id} value={recording.id}>
                      {recording.name || recording.id}
                    </option>
                  ))}
                </select>
              )}
              {errors.recordingId && (
                <p className="text-sm text-destructive">{errors.recordingId}</p>
              )}
            </div>

            {/* Cron Expression */}
            <div className="space-y-2">
              <Label htmlFor="cron">Schedule Frequency</Label>
              <select
                id="cron"
                value={cronPreset}
                onChange={(e) => setCronPreset(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CRON_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>

              {cronPreset === 'custom' && (
                <div className="space-y-2">
                  <Input
                    placeholder="* * * * * (minute hour day month weekday)"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    className={errors.cron ? 'border-destructive' : ''}
                  />
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Format: minute (0-59), hour (0-23), day of month (1-31),
                      month (1-12), day of week (0-6, 0=Sunday)
                    </span>
                  </div>
                </div>
              )}

              {errors.cron && (
                <p className="text-sm text-destructive">{errors.cron}</p>
              )}
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {/* Browser Selection */}
            <div className="space-y-2">
              <Label>Browser</Label>
              <div className="flex gap-2">
                {(['chromium', 'firefox', 'webkit'] as const).map((b) => (
                  <Button
                    key={b}
                    type="button"
                    variant={browser === b ? 'default' : 'outline'}
                    onClick={() => setBrowser(b)}
                    className="flex-1 capitalize"
                  >
                    {b}
                  </Button>
                ))}
              </div>
            </div>

            {/* Record Video */}
            <ToggleSwitch
              id="recordVideo"
              label="Record Video"
              description="Record a video of the test execution"
              icon={<VideoIcon className="h-5 w-5 text-muted-foreground" />}
              checked={recordVideo}
              onChange={setRecordVideo}
            />

            {/* Screenshot Mode */}
            <ScreenshotModeSelector
              value={screenshotMode}
              onChange={setScreenshotMode}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingRecordings}>
              {isSubmitting ? (
                <>
                  <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Schedule'
              )}
            </Button>
          </DialogFooter>
        </form>
    </Dialog>
  );
}
