'use client';

import * as React from 'react';
import { Search, FileJson, X, Library, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, type RecordingListItem } from '@/lib/api';

export interface SelectedRecording {
  id: string;
  name: string;
  url: string;
  actionCount: number;
  schemaVersion?: string;
}

interface RecordingSearchSelectProps {
  projectId: string;
  value: SelectedRecording | null;
  onChange: (recording: SelectedRecording | null) => void;
  disabled?: boolean;
  /** Label shown above the component */
  label?: string;
}

export function RecordingSearchSelect({
  projectId,
  value,
  onChange,
  disabled,
  label = 'Select from Library',
}: RecordingSearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [results, setResults] = React.useState<RecordingListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  // Load initial recordings when dropdown opens
  React.useEffect(() => {
    if (open && !hasSearched) {
      fetchRecordings('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  React.useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRecordings(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecordings = async (query: string) => {
    setIsLoading(true);
    try {
      const response = await api.listRecordings({
        projectId,
        search: query || undefined,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      setResults(response.data);
      setHasSearched(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (rec: RecordingListItem) => {
    onChange({
      id: rec.id,
      name: rec.name,
      url: rec.url,
      actionCount: rec.actionCount,
      schemaVersion: rec.schemaVersion,
    });
    setOpen(false);
    setSearch('');
  };

  const handleRemove = () => {
    onChange(null);
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    // Focus the search input after it renders
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Selected state - show compact card
  if (value) {
    return (
      <div className="space-y-1.5">
        {label && (
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        )}
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Library className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {value.actionCount} actions · {value.url ? (() => { try { return new URL(value.url).hostname; } catch { return 'unknown'; } })() : 'unknown'}
              {value.schemaVersion ? ` · v${value.schemaVersion}` : ''}
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

  // Unselected state - show search trigger / dropdown
  return (
    <div ref={containerRef} className="relative space-y-1.5">
      {label && (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      )}
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={handleOpen}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors',
            'border-border hover:border-primary/50 hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <Library className="h-5 w-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium">Browse Recording Library</p>
            <p className="text-xs text-muted-foreground">
              Search and select an existing recording
            </p>
          </div>
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-popover shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recordings..."
              className="border-0 bg-transparent p-0 h-8 shadow-none focus-visible:ring-0"
              disabled={disabled}
            />
            {isLoading && (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
            )}
          </div>

          {/* Results list */}
          <div className="max-h-64 overflow-y-auto p-1">
            {results.length === 0 && hasSearched && !isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {search ? 'No recordings match your search' : 'No recordings in library'}
              </div>
            ) : (
              results.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent transition-colors"
                  onClick={() => handleSelect(rec)}
                >
                  <FileJson className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{rec.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rec.actionCount} actions · {rec.url ? (() => { try { return new URL(rec.url).hostname; } catch { return rec.url; } })() : 'unknown'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
