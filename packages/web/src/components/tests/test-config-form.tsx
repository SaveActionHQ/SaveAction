'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { TestConfig } from '@/lib/api';

interface TestConfigFormProps {
  value: Partial<TestConfig>;
  onChange: (config: Partial<TestConfig>) => void;
  disabled?: boolean;
}

const SCREENSHOT_OPTIONS = [
  { value: 'only-on-failure', label: 'Only on failure' },
  { value: 'on', label: 'Always' },
  { value: 'off', label: 'Never' },
];

export const DEFAULT_TEST_CONFIG: TestConfig = {
  headless: true,
  video: false,
  screenshot: 'only-on-failure',
  timeout: 30000,
  retries: 0,
  slowMo: 0,
};

export function TestConfigForm({ value, onChange, disabled }: TestConfigFormProps) {
  const config = { ...DEFAULT_TEST_CONFIG, ...value };

  const update = <K extends keyof TestConfig>(key: K, val: TestConfig[K]) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-4">
      {/* Run mode toggles */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField
          label="Record Video"
          description="Capture video of test execution"
          checked={config.video}
          onChange={(v) => update('video', v)}
          disabled={disabled}
        />
      </div>

      {/* Screenshot mode */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Screenshots</label>
        <Select
          value={config.screenshot}
          onValueChange={(v) => update('screenshot', v as TestConfig['screenshot'])}
          options={SCREENSHOT_OPTIONS}
          disabled={disabled}
        />
      </div>

      {/* Numeric fields */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Timeout (ms)</label>
          <Input
            type="number"
            min={1000}
            max={120000}
            step={1000}
            value={config.timeout}
            onChange={(e) => update('timeout', Math.max(1000, Number(e.target.value) || 30000))}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">Max wait per action</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Retries</label>
          <Input
            type="number"
            min={0}
            max={5}
            value={config.retries}
            onChange={(e) => update('retries', Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">Retry on failure</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Slow Motion (ms)</label>
          <Input
            type="number"
            min={0}
            max={5000}
            step={100}
            value={config.slowMo}
            onChange={(e) => update('slowMo', Math.max(0, Number(e.target.value) || 0))}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">Delay between steps</p>
        </div>
      </div>

      {/* Viewport */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Custom Viewport</label>
        <p className="text-xs text-muted-foreground">
          Leave empty to use the viewport from the recording
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Width</label>
            <Input
              type="number"
              min={320}
              max={3840}
              placeholder="e.g. 1280"
              value={config.viewport?.width ?? ''}
              onChange={(e) => {
                const w = Number(e.target.value) || undefined;
                if (w) {
                  update('viewport', { width: w, height: config.viewport?.height ?? 720 });
                } else {
                  const next = { ...value };
                  delete next.viewport;
                  onChange(next);
                }
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Height</label>
            <Input
              type="number"
              min={200}
              max={2160}
              placeholder="e.g. 720"
              value={config.viewport?.height ?? ''}
              onChange={(e) => {
                const h = Number(e.target.value) || undefined;
                if (h) {
                  update('viewport', { width: config.viewport?.width ?? 1280, height: h });
                } else {
                  const next = { ...value };
                  delete next.viewport;
                  onChange(next);
                }
              }}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Simple toggle switch field */
function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-input p-3 cursor-pointer hover:bg-muted/50 transition-colors">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-primary' : 'bg-input'}
        `}
      >
        <span
          className={`
            pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </label>
  );
}
