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
import { api, type Schedule, type TestBrowser, ApiClientError } from '@/lib/api';
import { BrowserSelector } from '@/components/tests/browser-selector';

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
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
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

// Helper to detect if cron matches a preset
function detectCronPreset(cron: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === cron);
  return preset ? preset.value : 'custom';
}

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
    { value: 'on-failure', label: 'On Failure', description: 'Only when test fails' },
    { value: 'always', label: 'Always', description: 'After every test' },
    { value: 'never', label: 'Never', description: 'No screenshots' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <CameraIcon className="h-5 w-5 text-muted-foreground" />
        <Label>Screenshots</Label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
              value === mode.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <span className="text-sm font-medium">{mode.label}</span>
            <span className="text-xs text-muted-foreground text-center mt-1">
              {mode.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface EditScheduleDialogProps {
  schedule: Schedule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (schedule: Schedule) => void;
}

export function EditScheduleDialog({
  schedule,
  open,
  onOpenChange,
  onSuccess,
}: EditScheduleDialogProps) {
  const handleClose = () => onOpenChange(false);
  const { success, error: toastError } = useToast();

  // Form state - initialize from schedule
  const [name, setName] = useState(schedule.name);
  const [cronPreset, setCronPreset] = useState(detectCronPreset(schedule.cronExpression));
  const [customCron, setCustomCron] = useState(
    detectCronPreset(schedule.cronExpression) === 'custom' ? schedule.cronExpression : ''
  );
  const [timezone, setTimezone] = useState(schedule.timezone);
  const [browsers, setBrowsers] = useState<TestBrowser[]>(schedule.browsers ?? (schedule.browser ? [schedule.browser] : ['chromium']));
  const [recordVideo, setRecordVideo] = useState(schedule.recordVideo ?? false);
  const [screenshotMode, setScreenshotMode] = useState<ScreenshotMode>(schedule.screenshotMode ?? 'on-failure');

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when schedule changes
  useEffect(() => {
    if (open) {
      setName(schedule.name);
      const preset = detectCronPreset(schedule.cronExpression);
      setCronPreset(preset);
      setCustomCron(preset === 'custom' ? schedule.cronExpression : '');
      setTimezone(schedule.timezone);
      setBrowsers(schedule.browsers ?? (schedule.browser ? [schedule.browser] : ['chromium']));
      setRecordVideo(schedule.recordVideo ?? false);
      setScreenshotMode(schedule.screenshotMode ?? 'on-failure');
      setErrors({});
    }
  }, [open, schedule]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Schedule name is required';
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

    const cronExpression = cronPreset === 'custom' ? customCron.trim() : cronPreset;

    setIsSubmitting(true);
    try {
      const updatedSchedule = await api.updateSchedule(schedule.id, {
        name: name.trim(),
        cronExpression,
        timezone,
        browsers,
        recordVideo,
        screenshotMode,
      });

      success('Schedule updated successfully');
      onSuccess(updatedSchedule);
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to update schedule. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} className="sm:max-w-[550px]">
      <DialogHeader onClose={handleClose}>
        <DialogTitle>Edit Schedule</DialogTitle>
        <DialogDescription>
          Update the schedule configuration for your automated tests.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-4">
          {/* Schedule Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Schedule Name</Label>
            <Input
              id="edit-name"
              placeholder="e.g., Daily Login Test"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Target Info (Read Only) */}
          <div className="space-y-2">
            <Label>Target</Label>
            <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-2 rounded-md">
              {schedule.targetType === 'suite' && 'Entire Suite'}
              {schedule.targetType === 'test' && 'Individual Test'}
              {schedule.targetType === 'recording' && 'Recording (legacy)'}
              {schedule.suiteId && (
                <span className="block mt-1 text-xs">Suite ID: {schedule.suiteId}</span>
              )}
              {schedule.testId && (
                <span className="block mt-1 text-xs">Test ID: {schedule.testId}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Target cannot be changed. Create a new schedule for a different target.
            </p>
          </div>

          {/* Cron Expression */}
          <div className="space-y-2">
            <Label htmlFor="edit-cron">Schedule Frequency</Label>
            <select
              id="edit-cron"
              value={cronPreset}
              onChange={(e) => {
                setCronPreset(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomCron('');
                  }
                }}
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
              <Label htmlFor="edit-timezone">Timezone</Label>
              <select
                id="edit-timezone"
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
              <Label>Target Browsers</Label>
              <BrowserSelector value={browsers} onChange={setBrowsers} />
              {browsers.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Tests will run in {browsers.length} browsers. A separate run is created for each browser.
                </p>
              )}
            </div>

            {/* Record Video */}
            <ToggleSwitch
              id="edit-recordVideo"
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

            {/* Schedule Stats */}
            <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">Schedule Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Runs:</span>
                  <span className="ml-2 font-mono">{schedule.totalRuns}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`ml-2 capitalize ${schedule.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {schedule.status}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Passed:</span>
                  <span className="ml-2 font-mono text-green-600">{schedule.successfulRuns}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Failed:</span>
                  <span className="ml-2 font-mono text-red-600">{schedule.failedRuns}</span>
                </div>
                {schedule.lastRunAt && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Last Run:</span>
                    <span className="ml-2">{new Date(schedule.lastRunAt).toLocaleString()}</span>
                  </div>
                )}
                {schedule.nextRunAt && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Next Run:</span>
                    <span className="ml-2">{new Date(schedule.nextRunAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
    </Dialog>
  );
}
