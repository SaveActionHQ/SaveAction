'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useProjects } from '@/components/providers/project-provider';
import { api } from '@/lib/api';

/**
 * Hook to resolve the current project from the URL slug.
 * Used in project-scoped pages within the [projectSlug] route.
 *
 * Returns:
 * - `projectSlug` - the slug from the URL (for building links)
 * - `projectId` - the project UUID (for API calls)
 * - `project` - the full project object (or null if not found)
 */
export function useProjectFromSlug() {
  const params = useParams();
  const projectSlug = params.projectSlug as string;
  const { projects } = useProjects();
  const project = projects.find((p) => p.slug === projectSlug) ?? null;
  const projectId = project?.id ?? '';
  return { projectSlug, projectId, project };
}

// ─── Slug validation helpers ────────────────────────────────

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const SLUG_MAX_LENGTH = 100;
const DEBOUNCE_MS = 400;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX_LENGTH);
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length > SLUG_MAX_LENGTH) return false;
  if (slug.includes('--')) return false;
  return SLUG_REGEX.test(slug);
}

export function getSlugFormatError(slug: string): string {
  if (!slug) return 'Slug is required';
  if (slug.length < 2) return 'Slug must be at least 2 characters';
  if (slug.includes('--')) return 'No consecutive hyphens allowed';
  if (!SLUG_REGEX.test(slug)) return 'Must start and end with a letter or number';
  if (slug.length > SLUG_MAX_LENGTH) return `Slug must be ${SLUG_MAX_LENGTH} characters or fewer`;
  return '';
}

/**
 * Slug availability status returned by useSlugCheck.
 *
 * - `idle`      — nothing typed yet or slug is unchanged from original
 * - `checking`  — debounced API request in-flight
 * - `available` — slug is free
 * - `taken`     — slug already belongs to another project
 * - `invalid`   — slug has a format error (no API call made)
 */
export type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface UseSlugCheckOptions {
  /** If editing an existing project, exclude it from the uniqueness check. */
  excludeProjectId?: string;
  /** The current persisted slug (skip check when unchanged). */
  originalSlug?: string;
}

/**
 * Debounced slug availability checker.
 *
 * Usage:
 * ```tsx
 * const { slug, setSlugValue, slugStatus, slugError } = useSlugCheck();
 * ```
 */
export function useSlugCheck(options: UseSlugCheckOptions = {}) {
  const { excludeProjectId, originalSlug } = options;

  const [slug, setSlug] = useState(originalSlug ?? '');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [slugError, setSlugError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Allow parent to reset slug (e.g. when project loads)
  const setSlugValue = useCallback(
    (value: string) => {
      const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      setSlug(cleaned);

      // Cancel pending checks
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      // If empty or same as original, stay idle
      if (!cleaned || cleaned === originalSlug) {
        setSlugStatus(!cleaned ? 'invalid' : 'idle');
        setSlugError(!cleaned ? 'Slug is required' : '');
        return;
      }

      // Check format first
      const formatErr = getSlugFormatError(cleaned);
      if (formatErr) {
        setSlugStatus('invalid');
        setSlugError(formatErr);
        return;
      }

      // Debounced availability check
      setSlugStatus('checking');
      setSlugError('');

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const result = await api.checkSlugAvailability(cleaned, excludeProjectId);
          if (controller.signal.aborted) return;
          if (result.available) {
            setSlugStatus('available');
            setSlugError('');
          } else {
            setSlugStatus('taken');
            setSlugError('This slug is already taken');
          }
        } catch {
          if (controller.signal.aborted) return;
          // On network error, don't block — clear status
          setSlugStatus('idle');
          setSlugError('');
        }
      }, DEBOUNCE_MS);
    },
    [originalSlug, excludeProjectId]
  );

  // Clean-up on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  /** Whether the slug is in a blocking error state (taken or invalid). */
  const slugBlocked = slugStatus === 'taken' || slugStatus === 'invalid';

  return { slug, setSlugValue, slugStatus, slugError, slugBlocked, setSlug };
}
