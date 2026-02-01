'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/providers/toast-provider';
import { api, type RecordingData, ApiClientError } from '@/lib/api';

// Icons
function UploadIcon({ className }: { className?: string }) {
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
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
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
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
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

function CheckIcon({ className }: { className?: string }) {
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
      <path d="M20 6 9 17l-5-5" />
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

interface ValidationError {
  field: string;
  message: string;
}

interface ParsedRecording {
  data: RecordingData;
  isValid: boolean;
  errors: ValidationError[];
}

interface RecordingUploadProps {
  onUploadSuccess?: () => void;
  onClose?: () => void;
}

export function RecordingUpload({ onUploadSuccess, onClose }: RecordingUploadProps) {
  const { success, error: toastError } = useToast();
  const [parsedRecording, setParsedRecording] = useState<ParsedRecording | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Validate recording JSON structure
  const validateRecording = (data: unknown): ParsedRecording => {
    const errors: ValidationError[] = [];

    // Check if it's an object
    if (!data || typeof data !== 'object') {
      return {
        data: {} as RecordingData,
        isValid: false,
        errors: [{ field: 'root', message: 'Invalid JSON: expected an object' }],
      };
    }

    const record = data as Record<string, unknown>;

    // Required fields
    if (!record.id || typeof record.id !== 'string') {
      errors.push({ field: 'id', message: 'Missing or invalid "id" field (string required)' });
    }

    if (!record.testName || typeof record.testName !== 'string') {
      errors.push({ field: 'testName', message: 'Missing or invalid "testName" field (string required)' });
    }

    if (!record.url || typeof record.url !== 'string') {
      errors.push({ field: 'url', message: 'Missing or invalid "url" field (string required)' });
    }

    if (!record.startTime || typeof record.startTime !== 'string') {
      errors.push({ field: 'startTime', message: 'Missing or invalid "startTime" field (ISO string required)' });
    }

    // Viewport validation
    if (!record.viewport || typeof record.viewport !== 'object') {
      errors.push({ field: 'viewport', message: 'Missing or invalid "viewport" field (object required)' });
    } else {
      const viewport = record.viewport as Record<string, unknown>;
      if (typeof viewport.width !== 'number' || typeof viewport.height !== 'number') {
        errors.push({ field: 'viewport', message: 'Viewport must have numeric "width" and "height"' });
      }
    }

    if (!record.userAgent || typeof record.userAgent !== 'string') {
      errors.push({ field: 'userAgent', message: 'Missing or invalid "userAgent" field (string required)' });
    }

    // Actions validation
    if (!Array.isArray(record.actions)) {
      errors.push({ field: 'actions', message: 'Missing or invalid "actions" field (array required)' });
    } else if (record.actions.length === 0) {
      errors.push({ field: 'actions', message: 'Recording must have at least one action' });
    }

    if (!record.version || typeof record.version !== 'string') {
      errors.push({ field: 'version', message: 'Missing or invalid "version" field (string required)' });
    }

    return {
      data: data as RecordingData,
      isValid: errors.length === 0,
      errors,
    };
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    setUploadError(null);
    setUploadSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        const result = validateRecording(json);
        setParsedRecording(result);

        // Auto-fill name from testName if valid
        if (result.isValid && result.data.testName) {
          setName(result.data.testName);
        }
      } catch {
        setParsedRecording({
          data: {} as RecordingData,
          isValid: false,
          errors: [{ field: 'root', message: 'Invalid JSON: Could not parse file' }],
        });
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleUpload = async () => {
    if (!parsedRecording?.isValid || !name.trim()) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      await api.createRecording({
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        data: parsedRecording.data,
      });

      setUploadSuccess(true);
      success('Recording uploaded', `"${name.trim()}" has been uploaded successfully.`);
      onUploadSuccess?.();

      // Reset form after short delay
      setTimeout(() => {
        setParsedRecording(null);
        setFileName('');
        setName('');
        setDescription('');
        setTags([]);
        setUploadSuccess(false);
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof ApiClientError 
        ? error.message 
        : 'Failed to upload recording. Please try again.';
      setUploadError(errorMessage);
      toastError('Upload failed', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setParsedRecording(null);
    setFileName('');
    setName('');
    setDescription('');
    setTags([]);
    setTagInput('');
    setUploadError(null);
    setUploadSuccess(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Upload Recording</CardTitle>
            <CardDescription>
              Upload a JSON recording file from the SaveAction Chrome extension
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Message */}
        {uploadSuccess && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-success-light text-success border border-success/20">
            <CheckIcon className="h-5 w-5" />
            <span className="font-medium">Recording uploaded successfully!</span>
          </div>
        )}

        {/* Error Message */}
        {uploadError && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive-light text-destructive border border-destructive/20">
            <AlertCircleIcon className="h-5 w-5" />
            <span className="font-medium">{uploadError}</span>
          </div>
        )}

        {/* Dropzone */}
        {!parsedRecording && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive
                ? 'border-primary bg-primary-light/50'
                : 'border-border hover:border-primary/50 hover:bg-secondary/50'
              }
            `}
          >
            <input {...getInputProps()} />
            <UploadIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium text-primary">Drop the recording file here</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">
                  Drag & drop a recording file here
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to select a file
                </p>
                <Button variant="outline" type="button">
                  Select File
                </Button>
              </>
            )}
          </div>
        )}

        {/* File Preview & Form */}
        {parsedRecording && (
          <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
              <FileIcon className="h-8 w-8 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {parsedRecording.isValid
                    ? `${parsedRecording.data.actions?.length || 0} actions`
                    : 'Invalid recording'}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={handleReset}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Validation Errors */}
            {!parsedRecording.isValid && (
              <div className="p-4 rounded-lg bg-destructive-light border border-destructive/20">
                <p className="font-medium text-destructive mb-2">Validation Errors:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                  {parsedRecording.errors.map((error, i) => (
                    <li key={i}>{error.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recording Preview */}
            {parsedRecording.isValid && (
              <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3">
                <h4 className="font-medium">Recording Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Start URL:</span>
                    <p className="truncate" title={parsedRecording.data.url}>
                      {parsedRecording.data.url}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actions:</span>
                    <p>{parsedRecording.data.actions?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Viewport:</span>
                    <p>
                      {parsedRecording.data.viewport?.width}x
                      {parsedRecording.data.viewport?.height}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <p>{parsedRecording.data.version}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Form */}
            {parsedRecording.isValid && (
              <div className="space-y-4">
                {/* Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter recording name"
                  />
                </div>

                {/* Description Field */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>

                {/* Tags Field */}
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Add tags (press Enter or comma to add)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Press Enter or comma to add a tag
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={!name.trim() || isUploading}
                    isLoading={isUploading}
                    className="flex-1"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Recording'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
