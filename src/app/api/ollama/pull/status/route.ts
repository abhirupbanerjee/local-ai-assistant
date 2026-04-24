import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getActivePullJobs, getPullJob, cleanupOldJobs } from '@/lib/ollama-pull-jobs';

/**
 * GET /api/ollama/pull/status
 * 
 * Get status of active pull jobs
 * Query params: ?jobId=xxx (optional - if not provided, returns all active jobs)
 * 
 * Returns: { jobs: PullJob[] } or { job: PullJob } if jobId specified
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Clean up old completed jobs periodically
    cleanupOldJobs();

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
      // Return specific job
      const job = getPullJob(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ job });
    }

    // Return all active jobs
    const jobs = getActivePullJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('[Ollama Pull Status] Failed to get status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}