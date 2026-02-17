'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LibraryPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recording Library</h1>
        <p className="text-muted-foreground">
          Browse all recordings uploaded to this project
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recordings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <h3 className="text-lg font-medium">No recordings yet</h3>
            <p className="mt-2 text-muted-foreground">
              Recordings uploaded as tests will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
