'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/providers/toast-provider';
import { api } from '@/lib/api';

export default function NewSuitePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const toast = useToast();

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      toast.success('Test suite created');
      router.push(`/projects/${projectId}/suites/${suite.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create suite');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}/suites`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Test Suite</h1>
          <p className="text-muted-foreground">
            Create a new test suite to organize related tests
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Suite Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="suite-name" className="text-sm font-medium">
                Suite Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="suite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Checkout Flow, User Authentication"
                disabled={isSubmitting}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Choose a descriptive name that identifies this group of tests
              </p>
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

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/suites`)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Create Suite
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
