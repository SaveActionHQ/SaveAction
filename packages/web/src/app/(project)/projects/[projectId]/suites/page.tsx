'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { SuiteList } from '@/components/suites/suite-list';
import { CreateSuiteDialog, EditSuiteDialog } from '@/components/suites/create-suite-dialog';
import { useToast } from '@/components/providers/toast-provider';
import { api, TestSuiteWithStats } from '@/lib/api';

export default function SuitesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const toast = useToast();

  const [showCreate, setShowCreate] = React.useState(false);
  const [editingSuite, setEditingSuite] = React.useState<TestSuiteWithStats | null>(null);
  const [deletingSuite, setDeletingSuite] = React.useState<TestSuiteWithStats | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleCreated = () => {
    setRefreshKey((k) => k + 1);
    toast.success('Test suite created');
  };

  const handleUpdated = () => {
    setRefreshKey((k) => k + 1);
    toast.success('Test suite updated');
  };

  const handleDelete = async () => {
    if (!deletingSuite) return;
    setIsDeleting(true);
    try {
      await api.deleteSuite(projectId, deletingSuite.id);
      setRefreshKey((k) => k + 1);
      toast.success('Test suite deleted');
      setDeletingSuite(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete suite');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Suites</h1>
          <p className="text-muted-foreground">
            Organize your tests into logical groups
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Suite
          </Button>
        </div>
      </div>

      <SuiteList
        projectId={projectId}
        onEdit={setEditingSuite}
        onDelete={setDeletingSuite}
        refreshKey={refreshKey}
      />

      {/* Create dialog */}
      <CreateSuiteDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={projectId}
        onCreated={handleCreated}
      />

      {/* Edit dialog */}
      <EditSuiteDialog
        open={!!editingSuite}
        onClose={() => setEditingSuite(null)}
        projectId={projectId}
        suite={editingSuite}
        onUpdated={handleUpdated}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingSuite}
        onClose={() => setDeletingSuite(null)}
        onConfirm={handleDelete}
        title="Delete Test Suite"
        description={`Are you sure you want to delete "${deletingSuite?.name}"? All tests in this suite will also be deleted. This action cannot be undone.`}
        confirmLabel="Delete Suite"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
