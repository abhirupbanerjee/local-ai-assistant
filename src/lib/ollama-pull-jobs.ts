/**
 * Ollama Pull Job Manager
 * 
 * Manages background model pulls with progress tracking.
 * Uses in-memory storage (lost on restart) - for production, use Redis.
 */

interface PullJob {
  model: string;
  status: 'pending' | 'pulling' | 'success' | 'error';
  progress: number; // 0-100
  totalSize: number;
  downloadedSize: number;
  error?: string;
  startedAt: Date;
  updatedAt: Date;
}

// In-memory job storage
const pullJobs = new Map<string, PullJob>();

/**
 * Start a new pull job
 */
export function startPullJob(model: string): string {
  const jobId = `pull-${model}-${Date.now()}`;
  const job: PullJob = {
    model,
    status: 'pending',
    progress: 0,
    totalSize: 0,
    downloadedSize: 0,
    startedAt: new Date(),
    updatedAt: new Date(),
  };
  pullJobs.set(jobId, job);
  return jobId;
}

/**
 * Update pull job progress
 */
export function updatePullJob(jobId: string, updates: Partial<PullJob>): void {
  const job = pullJobs.get(jobId);
  if (job) {
    Object.assign(job, updates, { updatedAt: new Date() });
  }
}

/**
 * Get pull job status
 */
export function getPullJob(jobId: string): PullJob | undefined {
  return pullJobs.get(jobId);
}

/**
 * Get all active pull jobs
 */
export function getActivePullJobs(): PullJob[] {
  return Array.from(pullJobs.values()).filter(
    job => job.status === 'pending' || job.status === 'pulling'
  );
}

/**
 * Get pull job for a specific model
 */
export function getPullJobForModel(model: string): PullJob | undefined {
  return Array.from(pullJobs.values()).find(job => job.model === model);
}

/**
 * Clean up old completed jobs (older than 1 hour)
 */
export function cleanupOldJobs(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [jobId, job] of pullJobs.entries()) {
    if (
      (job.status === 'success' || job.status === 'error') &&
      job.updatedAt < oneHourAgo
    ) {
      pullJobs.delete(jobId);
    }
  }
}

/**
 * Execute background pull
 */
export async function executeBackgroundPull(
  jobId: string,
  model: string,
  ollamaBase: string
): Promise<void> {
  updatePullJob(jobId, { status: 'pulling' });

  try {
    const response = await fetch(`${ollamaBase}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      updatePullJob(jobId, {
        status: 'error',
        error: `Ollama API error: ${response.status} - ${errorText}`,
      });
      return;
    }

    // Read the stream incrementally
    const reader = response.body?.getReader();
    if (!reader) {
      updatePullJob(jobId, { status: 'error', error: 'No response body' });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);
          
          // Update progress
          if (parsed.total && parsed.completed) {
            const progress = Math.round((parsed.completed / parsed.total) * 100);
            updatePullJob(jobId, {
              progress,
              totalSize: parsed.total,
              downloadedSize: parsed.completed,
            });
          }

          // Check for completion
          if (parsed.status === 'success') {
            updatePullJob(jobId, { status: 'success', progress: 100 });
            return;
          }

          // Check for error
          if (parsed.status === 'error' || parsed.error) {
            updatePullJob(jobId, {
              status: 'error',
              error: parsed.error || 'Pull failed',
            });
            return;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    // Stream ended without explicit success - assume success if we made progress
    const job = getPullJob(jobId);
    if (job && job.progress > 0) {
      updatePullJob(jobId, { status: 'success', progress: 100 });
    } else {
      updatePullJob(jobId, { status: 'error', error: 'Pull incomplete' });
    }
  } catch (error) {
    updatePullJob(jobId, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}