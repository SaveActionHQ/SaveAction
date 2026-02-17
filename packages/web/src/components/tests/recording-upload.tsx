'use client';

import * as React from 'react';
import { Upload, FileJson, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RecordingInfo {
  data: Record<string, unknown>;
  name: string;
  url: string;
  actionCount: number;
  version: string;
  viewport?: { width: number; height: number };
}

interface RecordingUploadProps {
  value: RecordingInfo | null;
  onChange: (info: RecordingInfo | null) => void;
  disabled?: boolean;
  error?: string;
}

function parseRecording(raw: string): RecordingInfo {
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid recording: not a JSON object');
  }

  const rec = data as Record<string, unknown>;

  if (!rec.testName && !rec.url && !rec.actions) {
    throw new Error('Invalid recording: missing required fields (testName, url, actions)');
  }

  const actions = Array.isArray(rec.actions) ? rec.actions : [];

  return {
    data: rec,
    name: (rec.testName as string) || 'Untitled Recording',
    url: (rec.url as string) || '',
    actionCount: actions.length,
    version: (rec.version as string) || 'unknown',
    viewport: rec.viewport as { width: number; height: number } | undefined,
  };
}

export function RecordingUpload({ value, onChange, disabled, error }: RecordingUploadProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.json')) {
      setParseError('Please upload a .json recording file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const info = parseRecording(text);
        setParseError(null);
        onChange(info);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse recording');
        onChange(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  const handleRemove = () => {
    onChange(null);
    setParseError(null);
  };

  const displayError = error || parseError;

  if (value) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <FileJson className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {value.actionCount} actions · {value.url ? new URL(value.url).hostname : 'unknown'} · v{value.version}
            </p>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          dragActive
            ? 'border-primary bg-primary/5'
            : displayError
              ? 'border-destructive/50 bg-destructive/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
        {displayError ? (
          <>
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-medium text-destructive">{displayError}</p>
            <p className="text-xs text-muted-foreground mt-1">Click to try again</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Upload Recording</p>
            <p className="text-xs text-muted-foreground mt-1">
              Drag & drop a .json recording file, or click to browse
            </p>
          </>
        )}
      </div>
    </div>
  );
}
