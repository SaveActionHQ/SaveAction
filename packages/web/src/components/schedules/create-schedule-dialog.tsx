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
import { api, type Schedule, type TestSuite, type Test, type TestBrowser, type PaginatedResponse, ApiClientError } from '@/lib/api';
import { BrowserSelector } from '@/components/tests/browser-selector';
import { cn } from '@/lib/utils';

// Icons
function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" /><rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />
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
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Australia/Sydney',
];

type ScreenshotMode = 'on-failure' | 'always' | 'never';

function ToggleSwitch({ id, label, description, icon, checked, onChange }: {
  id: string; label: string; description: string; icon?: React.ReactNode; checked: boolean; onChange: (checked: boolean) => void;
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
        <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
      </label>
    </div>
  );
}

function ScreenshotModeSelector({ value, onChange }: { value: ScreenshotMode; onChange: (mode: ScreenshotMode) => void }) {
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
            <button key={mode.value} type="button" onClick={() => onChange(mode.value)}
              className={cn('flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                value === mode.value ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
              )} title={mode.description}>
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{modes.find((m) => m.value === value)?.description}</p>
      </div>
    </div>
  );
}

interface CreateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (schedule: Schedule) => void;
  initialSuiteId?: string;
  initialTestId?: string;
}

export function CreateScheduleDialog({ open, onOpenChange, onSuccess, initialSuiteId, initialTestId }: CreateScheduleDialogProps) {
  const handleClose = () => onOpenChange(false);
  const { success, error: toastError } = useToast();
  const activeProject = useActiveProject();

  const [name, setName] = useState('');
  const [suiteId, setSuiteId] = useState('');
  const [testId, setTestId] = useState('');
  const [targetType, setTargetType] = useState<'suite' | 'test'>('suite');
  const [cronPreset, setCronPreset] = useState('0 0 * * *');
  const [customCron, setCustomCron] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [browsers, setBrowsers] = useState<TestBrowser[]>(['chromium']);
  const [recordVideo, setRecordVideo] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState<ScreenshotMode>('on-failure');

  const [isLoadingSuites, setIsLoadingSuites] = useState(false);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [suitesError, setSuitesError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && activeProject) { loadSuites(); }
  }, [open, activeProject]);

  useEffect(() => {
    if (open) {
      if (initialSuiteId) setSuiteId(initialSuiteId);
      if (initialTestId) { setTestId(initialTestId); setTargetType('test'); }
    }
  }, [open, initialSuiteId, initialTestId]);

  useEffect(() => {
    if (suiteId && activeProject) { loadTests(suiteId); }
    else { setTests([]); setTestId(''); }
  }, [suiteId, activeProject]);

  // Auto-fill config when a test is selected
  useEffect(() => {
    if (!testId || !activeProject) return;

    let cancelled = false;

    const applyTestConfig = async () => {
      try {
        // Fetch full test details (list endpoint doesn't include config)
        const fullTest = await api.getTest(activeProject.id, testId);
        if (cancelled) return;

        // Apply test's browser config
        if (fullTest.browsers?.length) {
          setBrowsers(fullTest.browsers);
        }
        // Apply test's run config
        if (fullTest.config) {
          if (fullTest.config.video !== undefined) {
            setRecordVideo(fullTest.config.video);
          }
          if (fullTest.config.screenshot !== undefined) {
            const screenshotMap: Record<string, ScreenshotMode> = {
              'on': 'always',
              'only-on-failure': 'on-failure',
              'off': 'never',
            };
            setScreenshotMode(screenshotMap[fullTest.config.screenshot] ?? 'on-failure');
          }
        }
      } catch {
        // Silently fail — config auto-fill is a convenience, not critical
      }
    };

    applyTestConfig();
    return () => { cancelled = true; };
  }, [testId, activeProject]);

  useEffect(() => {
    if (!open) {
      setName(''); setSuiteId(''); setTestId(''); setTargetType('suite');
      setCronPreset('0 0 * * *'); setCustomCron(''); setTimezone('UTC');
      setBrowsers(['chromium']); setRecordVideo(false); setScreenshotMode('on-failure');
      setErrors({}); setTests([]);
    }
  }, [open]);

  const loadSuites = async () => {
    if (!activeProject) { setSuites([]); return; }
    setIsLoadingSuites(true); setSuitesError(null);
    try {
      const response = await api.listSuites(activeProject.id, { limit: 100 });
      setSuites(response.data);
    } catch (err) {
      setSuitesError(err instanceof ApiClientError ? err.message : 'Failed to load test suites');
    } finally { setIsLoadingSuites(false); }
  };

  const loadTests = async (selectedSuiteId: string) => {
    if (!activeProject) return;
    setIsLoadingTests(true);
    try {
      const response: PaginatedResponse<Test> = await api.listTests(activeProject.id, { suiteId: selectedSuiteId, limit: 100 });
      setTests(response.data);
    } catch { setTests([]); }
    finally { setIsLoadingTests(false); }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Schedule name is required';
    if (!suiteId) newErrors.suiteId = 'Please select a test suite';
    if (targetType === 'test' && !testId) newErrors.testId = 'Please select a test';
    if (browsers.length === 0) newErrors.browsers = 'Select at least one browser';
    const cronValue = cronPreset === 'custom' ? customCron : cronPreset;
    if (!cronValue.trim()) { newErrors.cron = 'Cron expression is required'; }
    else if (cronValue.trim().split(/\s+/).length !== 5) { newErrors.cron = 'Invalid cron expression (must have 5 fields)'; }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!activeProject) { toastError('No project selected.'); return; }

    const cronExpression = cronPreset === 'custom' ? customCron.trim() : cronPreset;
    setIsSubmitting(true);
    try {
      const schedule = await api.createSchedule({
        projectId: activeProject.id, targetType, suiteId,
        ...(targetType === 'test' && testId ? { testId } : {}),
        name: name.trim(), cronExpression, timezone, browsers, recordVideo, screenshotMode,
      });
      success('Schedule created successfully');
      onSuccess(schedule);
    } catch (err) {
      toastError(err instanceof ApiClientError ? err.message : 'Failed to create schedule. Please try again.');
    } finally { setIsSubmitting(false); }
  };

  return (
    <Dialog open={open} onClose={handleClose} className="sm:max-w-[550px]">
      <DialogHeader onClose={handleClose}>
        <DialogTitle>Create Schedule</DialogTitle>
        <DialogDescription>Set up an automated schedule to run your tests at specified intervals.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-4">
          {/* Schedule Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Schedule Name</Label>
            <Input id="name" placeholder="e.g., Daily Login Test" value={name} onChange={(e) => setName(e.target.value)} className={errors.name ? 'border-destructive' : ''} />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          {/* Target Type */}
          <div className="space-y-2">
            <Label>What to Schedule</Label>
            <div className="flex gap-2">
              <Button type="button" variant={targetType === 'suite' ? 'default' : 'outline'} onClick={() => { setTargetType('suite'); setTestId(''); }} className="flex-1">Entire Suite</Button>
              <Button type="button" variant={targetType === 'test' ? 'default' : 'outline'} onClick={() => setTargetType('test')} className="flex-1">Individual Test</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {targetType === 'suite' ? 'All tests in the selected suite will run on schedule.' : 'Only the selected test will run on schedule.'}
            </p>
          </div>

          {/* Suite Selection */}
          <div className="space-y-2">
            <Label htmlFor="suite">Test Suite</Label>
            {isLoadingSuites ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderIcon className="h-4 w-4 animate-spin" />Loading suites...</div>
            ) : suitesError ? (
              <div className="text-sm text-destructive">{suitesError}</div>
            ) : (
              <select id="suite" value={suiteId} onChange={(e) => { setSuiteId(e.target.value); setTestId(''); }}
                className={`w-full h-10 rounded-md border ${errors.suiteId ? 'border-destructive' : 'border-input'} bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
                <option value="">Select a test suite...</option>
                {suites.map((suite) => (
                  <option key={suite.id} value={suite.id}>{suite.name}{suite.testCount !== undefined ? ` (${suite.testCount} tests)` : ''}</option>
                ))}
              </select>
            )}
            {errors.suiteId && <p className="text-sm text-destructive">{errors.suiteId}</p>}
          </div>

          {/* Test Selection (individual test only) */}
          {targetType === 'test' && suiteId && (
            <div className="space-y-2">
              <Label htmlFor="test">Test</Label>
              {isLoadingTests ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderIcon className="h-4 w-4 animate-spin" />Loading tests...</div>
              ) : tests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tests found in this suite.</p>
              ) : (
                <>
                  <select id="test" value={testId} onChange={(e) => setTestId(e.target.value)}
                    className={`w-full h-10 rounded-md border ${errors.testId ? 'border-destructive' : 'border-input'} bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
                    <option value="">Select a test...</option>
                    {tests.map((test) => (<option key={test.id} value={test.id}>{test.name}</option>))}
                  </select>
                  {testId && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <InfoIcon className="h-3 w-3" />
                      Config auto-filled from test settings
                    </p>
                  )}
                </>
              )}
              {errors.testId && <p className="text-sm text-destructive">{errors.testId}</p>}
            </div>
          )}

          {/* Cron Expression */}
          <div className="space-y-2">
            <Label htmlFor="cron">Schedule Frequency</Label>
            <select id="cron" value={cronPreset} onChange={(e) => setCronPreset(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {CRON_PRESETS.map((preset) => (<option key={preset.value} value={preset.value}>{preset.label}</option>))}
            </select>
            {cronPreset === 'custom' && (
              <div className="space-y-2">
                <Input placeholder="* * * * * (minute hour day month weekday)" value={customCron} onChange={(e) => setCustomCron(e.target.value)} className={errors.cron ? 'border-destructive' : ''} />
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Format: minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, 0=Sunday)</span>
                </div>
              </div>
            )}
            {errors.cron && <p className="text-sm text-destructive">{errors.cron}</p>}
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {TIMEZONES.map((tz) => (<option key={tz} value={tz}>{tz}</option>))}
            </select>
          </div>

          {/* Browser Selection */}
          <div className="space-y-2">
            <Label>Target Browsers</Label>
            <BrowserSelector value={browsers} onChange={setBrowsers} error={errors.browsers} />
            <p className="text-xs text-muted-foreground">
              {browsers.length > 1
                ? `Tests will run in ${browsers.length} browsers. A separate run is created for each browser.`
                : 'Select one or more browsers to run tests in.'}
            </p>
          </div>

          {/* Record Video */}
          <ToggleSwitch id="recordVideo" label="Record Video" description="Record a video of the test execution" icon={<VideoIcon className="h-5 w-5 text-muted-foreground" />} checked={recordVideo} onChange={setRecordVideo} />

          {/* Screenshot Mode */}
          <ScreenshotModeSelector value={screenshotMode} onChange={setScreenshotMode} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || isLoadingSuites}>
            {isSubmitting ? (<><LoaderIcon className="h-4 w-4 mr-2 animate-spin" />Creating...</>) : 'Create Schedule'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
