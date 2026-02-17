'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjects } from '@/components/providers/project-provider';

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { projects } = useProjects();

  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-muted-foreground">
          Configure settings for {project?.name || 'this project'}
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              Project settings form coming in a future phase
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Default Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              Default browser and run configuration settings
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              Delete project and all associated data
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
