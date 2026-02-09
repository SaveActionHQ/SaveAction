'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RecordingUpload } from '@/components/recordings/recording-upload';
import { RecordingsList } from '@/components/recordings/recordings-list';
import { api, ApiClientError } from '@/lib/api';

// Icons
function PlusIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
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
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export default function RecordingsPage() {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Search and filter state
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Available tags
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Refresh key to force re-fetch
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle escape key and body scroll for dialog
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showUploadDialog) {
        setShowUploadDialog(false);
      }
    };

    if (showUploadDialog) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showUploadDialog]);

  // Fetch available tags
  const fetchTags = useCallback(async () => {
    setLoadingTags(true);
    try {
      const tags = await api.getRecordingTags();
      setAvailableTags(tags ?? []);
    } catch (err) {
      // Silently fail - tags are optional
      console.error('Failed to fetch tags:', err);
    } finally {
      setLoadingTags(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleUploadSuccess = () => {
    setShowUploadDialog(false);
    setRefreshKey((k) => k + 1);
    fetchTags(); // Refresh tags in case new ones were added
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setSelectedTags([]);
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const hasActiveFilters = search || selectedTags.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recordings</h1>
          <p className="text-muted-foreground">
            Manage your browser test recordings
          </p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <PlusIcon className="h-4 w-4" />
          Upload Recording
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
          className="sm:w-auto"
        >
          <FilterIcon className="h-4 w-4" />
          Filters
          {selectedTags.length > 0 && (
            <Badge variant="default" className="ml-2">
              {selectedTags.length}
            </Badge>
          )}
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={handleClearFilters}>
            Clear All
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* Tags Filter */}
            <div className="flex-1">
              <h3 className="text-sm font-medium mb-2">Filter by Tags</h3>
              {loadingTags ? (
                <div className="text-sm text-muted-foreground">Loading tags...</div>
              ) : availableTags?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag}
                      {selectedTags.includes(tag) && (
                        <XIcon className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No tags available. Add tags when uploading recordings.
                </div>
              )}
            </div>

            {/* Sort Options */}
            <div className="sm:w-48">
              <h3 className="text-sm font-medium mb-2">Sort By</h3>
              <div className="flex flex-col gap-2">
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSortBy, newSortOrder] = e.target.value.split('-') as [
                      'createdAt' | 'updatedAt' | 'name',
                      'asc' | 'desc'
                    ];
                    setSortBy(newSortBy);
                    setSortOrder(newSortOrder);
                  }}
                  className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="createdAt-desc">Newest First</option>
                  <option value="createdAt-asc">Oldest First</option>
                  <option value="updatedAt-desc">Recently Updated</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recordings List */}
      <RecordingsList
        key={refreshKey}
        search={search}
        tags={selectedTags.length > 0 ? selectedTags : undefined}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowUploadDialog(false)}
          />
          {/* Content */}
          <div className="relative z-10 w-full max-w-2xl mx-4 animate-in fade-in-0 zoom-in-95">
            <RecordingUpload
              onUploadSuccess={handleUploadSuccess}
              onClose={() => setShowUploadDialog(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
