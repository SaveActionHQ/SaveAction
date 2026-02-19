'use client';

import * as React from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api, TestSuiteWithStats } from '@/lib/api';

interface CreateSuiteDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: (suite: TestSuiteWithStats) => void;
}

export function CreateSuiteDialog({
  open,
  onClose,
  projectId,
  onCreated,
}: CreateSuiteDialogProps) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Suite name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const suite = await api.createSuite(projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      // Cast to TestSuiteWithStats with defaults
      const suiteWithStats: TestSuiteWithStats = {
        ...suite,
        testCount: 0,
        lastRunAt: null,
        passRate: null,
      };
      onCreated(suiteWithStats);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create suite');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>Create Test Suite</DialogTitle>
        <DialogDescription>
          Organize related tests into a logical group
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="suite-name" className="text-sm font-medium">
              Suite Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="suite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Checkout Flow"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="suite-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="suite-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this test suite"
              disabled={isSubmitting}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Suite
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

interface EditSuiteDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  suite: TestSuiteWithStats | null;
  onUpdated: (suite: TestSuiteWithStats) => void;
}

export function EditSuiteDialog({
  open,
  onClose,
  projectId,
  suite,
  onUpdated,
}: EditSuiteDialogProps) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && suite) {
      setName(suite.name);
      setDescription(suite.description || '');
      setError(null);
    }
  }, [open, suite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!suite) return;
    if (!name.trim()) {
      setError('Suite name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await api.updateSuite(projectId, suite.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      const updatedWithStats: TestSuiteWithStats = {
        ...updated,
        testCount: suite.testCount,
        lastRunAt: suite.lastRunAt,
        passRate: suite.passRate,
      };
      onUpdated(updatedWithStats);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update suite');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>Edit Test Suite</DialogTitle>
        <DialogDescription>
          Update suite name and description
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="edit-suite-name" className="text-sm font-medium">
              Suite Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="edit-suite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Checkout Flow"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-suite-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="edit-suite-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this test suite"
              disabled={isSubmitting}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
