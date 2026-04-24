import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getApiBase } from '@/lib/provider-helpers';
import {
  startPullJob,
  getPullJobForModel,
  executeBackgroundPull,
} from '@/lib/ollama-pull-jobs';

/**
 * POST /api/ollama/pull
 * 
 * Start a background model pull
 * Body: { model: "gemma3:latest" }
 * 
 * Returns immediately with jobId, pull continues in background
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { model } = body;

    if (!model || typeof model !== 'string') {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }

    const ollamaBase = await getApiBase('ollama');
    if (!ollamaBase) {
      return NextResponse.json({ error: 'Ollama not configured' }, { status: 500 });
    }

    // Check if there's already an active pull for this model
    const existingJob = getPullJobForModel(model);
    if (existingJob && (existingJob.status === 'pending' || existingJob.status === 'pulling')) {
      return NextResponse.json({
        success: true,
        jobId: existingJob.model, // Return model name as identifier
        model,
        status: existingJob.status,
        progress: existingJob.progress,
        message: 'Pull already in progress',
      });
    }

    // Start new pull job
    const jobId = startPullJob(model);

    // Execute pull in background (don't await)
    executeBackgroundPull(jobId, model, ollamaBase).catch(err => {
      console.error(`[Ollama Pull] Background pull failed for ${model}:`, err);
    });

    // Return immediately with job info
    return NextResponse.json({
      success: true,
      jobId,
      model,
      status: 'pulling',
      progress: 0,
      message: 'Pull started in background',
    });
  } catch (error) {
    console.error('[Ollama Pull] Failed to start pull:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start pull' },
      { status: 500 }
    );
  }
}