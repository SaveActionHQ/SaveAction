'use client';

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { RunAction } from './run-actions-table';

// Icons
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

function DownloadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ZoomInIcon({ className }: { className?: string }) {
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
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
      <line x1="11" x2="11" y1="8" y2="14" />
      <line x1="8" x2="14" y1="11" y2="11" />
    </svg>
  );
}

function ZoomOutIcon({ className }: { className?: string }) {
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
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
      <line x1="8" x2="14" y1="11" y2="11" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
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
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

// Screenshot item type
interface ScreenshotItem {
  actionId: string;
  actionIndex: number;
  actionType: string;
  status: RunAction['status'];
  errorMessage?: string;
}

// Build screenshot URL with JWT token for auth
function getScreenshotUrl(runId: string, actionId: string, browser?: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const token = api.getAccessToken();
  let url = `${apiUrl}/api/v1/runs/${runId}/actions/${actionId}/screenshot?token=${token}`;
  if (browser) {
    url += `&browser=${browser}`;
  }
  return url;
}

// Thumbnail Component with lazy loading
interface ThumbnailProps {
  runId: string;
  item: ScreenshotItem;
  onClick: () => void;
  isSelected?: boolean;
  browser?: string;
}

function Thumbnail({ runId, item, onClick, isSelected, browser }: ThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px', threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const statusColor = item.status === 'failed' 
    ? 'border-destructive' 
    : item.status === 'success' 
      ? 'border-success' 
      : 'border-border';

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={cn(
        'relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all duration-200',
        'border-2 hover:border-primary hover:shadow-lg hover:scale-[1.02]',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isSelected ? 'border-primary ring-2 ring-primary ring-offset-2' : statusColor,
        hasError && 'bg-secondary'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Loading skeleton */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary">
          <div className="animate-pulse flex flex-col items-center gap-1">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 p-2">
          <AlertCircleIcon className="h-6 w-6 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground text-center">Failed to load</span>
        </div>
      )}

      {/* Actual image (lazy loaded) */}
      {isVisible && !hasError && (
        <img
          ref={imgRef}
          src={getScreenshotUrl(runId, item.actionId, browser)}
          alt={`Screenshot for ${item.actionType} action #${item.actionIndex + 1}`}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Action badge overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="flex items-center justify-between text-white text-xs">
          <span className="font-medium capitalize">#{item.actionIndex + 1} {item.actionType}</span>
          {item.status === 'failed' && (
            <span className="bg-destructive/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold">
              Failed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Lightbox Modal Component
interface LightboxProps {
  open: boolean;
  onClose: () => void;
  runId: string;
  items: ScreenshotItem[];
  initialIndex: number;
  browser?: string;
}

function Lightbox({ open, onClose, runId, items, initialIndex, browser }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const currentItem = items[currentIndex];

  // Reset state when opening or changing item
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsLoading(true);
    setHasError(false);
  }, [initialIndex, open]);

  // Reset loading state when changing images
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          setZoom(1);
          setPosition({ x: 0, y: 0 });
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, currentIndex, items.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  }, [items.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  }, [items.length]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  const handleDownload = async () => {
    try {
      const token = api.getAccessToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const screenshotUrl = `${apiUrl}/api/v1/runs/${runId}/actions/${currentItem.actionId}/screenshot${browser ? `?browser=${browser}` : ''}`;
      const response = await fetch(
        screenshotUrl,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenshot-${currentItem.actionIndex + 1}-${currentItem.actionId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download screenshot:', error);
    }
  };

  // Mouse drag for panning when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content Container */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex items-center gap-4 text-white">
            <span className="text-sm">
              {currentIndex + 1} / {items.length}
            </span>
            <span className="text-sm text-white/70">
              #{currentItem.actionIndex + 1} {currentItem.actionType}
              {currentItem.status === 'failed' && (
                <span className="ml-2 text-destructive">Failed</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 mr-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/20"
                onClick={handleZoomOut}
                disabled={zoom <= 1}
              >
                <ZoomOutIcon className="h-4 w-4" />
              </Button>
              <span className="text-white text-sm min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/20"
                onClick={handleZoomIn}
                disabled={zoom >= 4}
              >
                <ZoomInIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Download button */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/20"
              onClick={handleDownload}
              title="Download screenshot"
            >
              <DownloadIcon className="h-5 w-5" />
            </Button>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/20"
              onClick={onClose}
            >
              <XIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main Image Area */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {/* Navigation buttons */}
          {items.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon-lg"
                className="absolute left-4 text-white hover:bg-white/20 z-20"
                onClick={goToPrevious}
              >
                <ChevronLeftIcon className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon-lg"
                className="absolute right-4 text-white hover:bg-white/20 z-20"
                onClick={goToNext}
              >
                <ChevronRightIcon className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Loading state */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-pulse text-white flex flex-col items-center gap-2">
                <ImageIcon className="h-12 w-12 text-white/50" />
                <span>Loading screenshot...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <AlertCircleIcon className="h-12 w-12 text-destructive mb-3" />
              <p className="text-lg font-medium">Failed to load screenshot</p>
              <p className="text-sm text-white/70 mt-1">The screenshot may not be available</p>
            </div>
          )}

          {/* Image */}
          {!hasError && (
            <img
              ref={imgRef}
              src={getScreenshotUrl(runId, currentItem.actionId, browser)}
              alt={`Screenshot for ${currentItem.actionType} action #${currentItem.actionIndex + 1}`}
              className={cn(
                'max-h-[calc(100vh-160px)] max-w-[calc(100vw-100px)] object-contain transition-all duration-200',
                isLoading && 'opacity-0'
              )}
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              }}
              draggable={false}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>

        {/* Error details */}
        {currentItem.errorMessage && (
          <div className="p-4 bg-gradient-to-t from-black/50 to-transparent">
            <div className="bg-destructive/20 border border-destructive/50 rounded-lg p-3 max-w-2xl mx-auto">
              <p className="text-sm text-white font-medium mb-1">Error Message</p>
              <pre className="text-xs text-white/80 whitespace-pre-wrap font-mono overflow-x-auto max-h-24 overflow-y-auto">
                {currentItem.errorMessage}
              </pre>
            </div>
          </div>
        )}

        {/* Thumbnail strip */}
        {items.length > 1 && (
          <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex justify-center gap-2 overflow-x-auto max-w-full pb-2">
              {items.map((item, index) => (
                <button
                  key={item.actionId}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all',
                    index === currentIndex
                      ? 'border-primary ring-2 ring-primary'
                      : 'border-white/30 hover:border-white/60',
                    item.status === 'failed' && index !== currentIndex && 'border-destructive/50'
                  )}
                >
                  <img
                    src={getScreenshotUrl(runId, item.actionId, browser)}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Screenshot Gallery Component
interface ScreenshotGalleryProps {
  runId: string;
  actions: RunAction[];
  className?: string;
  browser?: string;
}

export function ScreenshotGallery({ runId, actions, className, browser }: ScreenshotGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter actions that have screenshots
  const screenshotItems: ScreenshotItem[] = actions
    .filter((action) => action.screenshotPath)
    .map((action) => ({
      actionId: action.actionId,
      actionIndex: action.actionIndex,
      actionType: action.actionType,
      status: action.status,
      errorMessage: action.errorMessage,
    }));

  const handleThumbnailClick = (index: number) => {
    setSelectedIndex(index);
    setLightboxOpen(true);
  };

  if (screenshotItems.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-8 text-center',
          className
        )}
      >
        <CameraIcon className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">No Screenshots Available</p>
        <p className="text-sm text-muted-foreground mt-1">
          Screenshots are captured for failed actions or when screenshot mode is set to &quot;always&quot;.
        </p>
      </div>
    );
  }

  const failedCount = screenshotItems.filter((item) => item.status === 'failed').length;
  const successCount = screenshotItems.filter((item) => item.status === 'success').length;

  return (
    <div className={className}>
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CameraIcon className="h-4 w-4" />
          <span>{screenshotItems.length} screenshot{screenshotItems.length !== 1 ? 's' : ''}</span>
          {failedCount > 0 && (
            <span className="text-destructive">
              • {failedCount} failed
            </span>
          )}
          {successCount > 0 && failedCount > 0 && (
            <span className="text-success">
              • {successCount} passed
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Click to enlarge
        </span>
      </div>

      {/* Thumbnail Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {screenshotItems.map((item, index) => (
          <Thumbnail
            key={item.actionId}
            runId={runId}
            item={item}
            onClick={() => handleThumbnailClick(index)}
            isSelected={lightboxOpen && selectedIndex === index}
            browser={browser}
          />
        ))}
      </div>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        runId={runId}
        items={screenshotItems}
        initialIndex={selectedIndex}
        browser={browser}
      />
    </div>
  );
}

// Screenshot indicator icon for actions table
export function ScreenshotIndicator({
  hasScreenshot,
  onClick,
  className,
}: {
  hasScreenshot: boolean;
  onClick?: () => void;
  className?: string;
}) {
  if (!hasScreenshot) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'p-1 rounded hover:bg-secondary transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
        className
      )}
      title="View screenshot"
    >
      <CameraIcon className="h-4 w-4 text-primary" />
    </button>
  );
}
