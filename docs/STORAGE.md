# Storage & Cleanup

> **Video and Screenshot Storage with Automatic Cleanup**

## Overview

SaveAction stores videos and screenshots from test runs on the local filesystem. Automatic background jobs clean up old files to prevent disk exhaustion.

## Storage Paths

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `VIDEO_STORAGE_PATH` | `./storage/videos` | Directory for video recordings |
| `SCREENSHOT_STORAGE_PATH` | `./storage/screenshots` | Directory for screenshots |

### File Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Video | `run-{runId}.webm` | `run-abc123.webm` |
| Screenshot | `run-{runId}-{step}.png` | `run-abc123-1.png` |

### Directory Structure

```
storage/
├── videos/
│   ├── run-abc123.webm
│   ├── run-def456.webm
│   └── run-ghi789.mp4
└── screenshots/
    ├── run-abc123-1.png
    ├── run-abc123-2.png
    └── run-def456-1.jpg
```

## Docker Volume Configuration

For production deployments, mount storage directories as Docker volumes:

```yaml
# docker-compose.yml
services:
  worker:
    image: saveaction/worker
    environment:
      - VIDEO_STORAGE_PATH=/data/videos
      - SCREENSHOT_STORAGE_PATH=/data/screenshots
    volumes:
      - video-storage:/data/videos
      - screenshot-storage:/data/screenshots

volumes:
  video-storage:
  screenshot-storage:
```

### Kubernetes PersistentVolumeClaim

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: saveaction-storage
spec:
  accessModes:
    - ReadWriteMany  # Required for multiple workers
  resources:
    requests:
      storage: 100Gi
```

## Automatic Cleanup

Background jobs automatically delete old files to prevent disk exhaustion.

### Cleanup Schedule

| Job | Schedule | Retention | Cron Expression |
|-----|----------|-----------|-----------------|
| Old Videos | Daily 3:00 AM | 30 days | `0 3 * * *` |
| Old Screenshots | Daily 3:30 AM | 30 days | `30 3 * * *` |
| Orphaned Runs | Hourly | 10 minutes | `0 * * * *` |

### Cleanup Behavior

1. **File Age Check**: Files older than retention period are candidates for deletion
2. **Active Run Protection**: Files associated with currently running tests are never deleted
3. **Orphan Detection**: Files without matching database records are cleaned up
4. **Error Handling**: Individual file errors don't stop the cleanup job

### Supported File Types

| Type | Extensions |
|------|------------|
| Videos | `.webm`, `.mp4` |
| Screenshots | `.png`, `.jpg`, `.jpeg` |

## Manual Cleanup

You can trigger cleanup jobs manually via the BullMQ admin interface or by adding jobs directly:

```typescript
// Add immediate cleanup job
await jobQueueManager.addJob('cleanup', {
  cleanupType: 'old-videos',
  maxAgeDays: 7,  // Override default retention
  createdAt: new Date().toISOString(),
});
```

## Monitoring Storage

### Disk Usage Check

```bash
# Check storage directory sizes
du -sh ./storage/videos
du -sh ./storage/screenshots

# Count files
find ./storage/videos -type f | wc -l
find ./storage/screenshots -type f | wc -l
```

### Health Endpoint

The `/health` endpoint includes storage path accessibility:

```json
{
  "status": "healthy",
  "checks": {
    "videoStorage": "ok",
    "screenshotStorage": "ok"
  }
}
```

## Storage Estimates

| Scenario | Videos/Day | Screenshots/Day | Daily Storage | Monthly Storage |
|----------|------------|-----------------|---------------|-----------------|
| Small Team | 10 | 50 | ~200 MB | ~6 GB |
| Medium Team | 50 | 250 | ~1 GB | ~30 GB |
| Enterprise | 500 | 2500 | ~10 GB | ~300 GB |

**Assumptions:**
- Average video: ~20 MB (60 seconds)
- Average screenshot: ~500 KB

## Future: S3-Compatible Storage

> **Status: P3 - Planned for future release**

S3-compatible object storage support for scalability:

```bash
# Future environment variables
STORAGE_PROVIDER=s3           # local | s3
S3_BUCKET=saveaction-storage
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_ENDPOINT=...               # For MinIO/custom S3
```

Benefits:
- Unlimited storage capacity
- Cross-region replication
- Cost-effective long-term storage
- Direct browser access via presigned URLs
