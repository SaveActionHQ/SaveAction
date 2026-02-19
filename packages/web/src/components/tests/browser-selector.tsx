'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { TestBrowser } from '@/lib/api';

const BROWSERS: { value: TestBrowser; label: string; icon: string }[] = [
  { value: 'chromium', label: 'Chrome', icon: '/chrome.png' },
  { value: 'firefox', label: 'Firefox', icon: '/firefox.png' },
  { value: 'webkit', label: 'Safari', icon: '/safari.png' },
];

interface BrowserSelectorProps {
  value: TestBrowser[];
  onChange: (browsers: TestBrowser[]) => void;
  disabled?: boolean;
  error?: string;
}

export function BrowserSelector({ value, onChange, disabled, error }: BrowserSelectorProps) {
  const toggle = (browser: TestBrowser) => {
    if (disabled) return;
    if (value.includes(browser)) {
      // Don't allow deselecting the last browser
      if (value.length === 1) return;
      onChange(value.filter((b) => b !== browser));
    } else {
      onChange([...value, browser]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {BROWSERS.map((browser) => {
          const selected = value.includes(browser.value);
          return (
            <button
              key={browser.value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(browser.value)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <img src={browser.icon} alt={browser.label} className="h-5 w-5 object-contain" />
              {browser.label}
              {selected && (
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
