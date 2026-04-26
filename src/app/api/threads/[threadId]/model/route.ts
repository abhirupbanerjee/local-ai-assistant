import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getThread } from '@/lib/threads';
import { updateThreadModel, getEffectiveModelForThread, getThreadById } from '@/lib/db/compat';
import { getActiveModels, getDefaultModel, getEnabledModel } from '@/lib/db/compat/enabled-models';
import { getRoutesSettings } from '@/lib/db/compat/config';
import type { ApiError } from '@/types';

/**
 * Determine which route a model belongs to based on provider_id.
 * Route 3: ollama, ollama-cloud (local/cloud Ollama infrastructure)
 * Route 2: anthropic, fireworks, claude (direct cloud providers)
 * Route 1: all others (LiteLLM/OpenAI route)
 */
function getModelRoute(providerId: string): 'route1' | 'route2' | 'route3' {
  // Route 3: Ollama infrastructure (local or cloud)
  if (providerId === 'ollama' || providerId === 'ollama-cloud') {
    return 'route3';
  }
  // Route 2: Direct cloud providers (bypass LiteLLM)
  if (providerId === 'anthropic' || providerId === 'fireworks') {
    return 'route2';
  }
  // Route 1: LiteLLM/OpenAI route (default)
  return 'route1';
}

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

/**
 * GET /api/threads/[threadId]/model
 *
 * Get current model configuration for a thread
 * Returns: current override, effective model, and available models
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { threadId } = await params;

    // Use getThread which handles ownership verification internally
    const thread = await getThread(user.id, threadId);
    if (!thread) {
      return NextResponse.json<ApiError>(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get the raw thread data for selected_model field
    const dbThread = await getThreadById(threadId);

    // Get available models (only active/enabled ones), filtered by active routes
    const allModels = await getActiveModels();
    const routesSettings = await getRoutesSettings();
    const availableModels = allModels.filter(m => {
      // Use provider_id for accurate route determination
      const route = getModelRoute(m.providerId);
      if (route === 'route3') return routesSettings.route3Enabled;
      if (route === 'route2') return routesSettings.route2Enabled;
      return routesSettings.route1Enabled;
    });

    // Get global default
    const defaultModel = await getDefaultModel();
    const globalDefault = defaultModel?.id || null;

    // Get effective model (thread override or global)
    const effectiveModel = await getEffectiveModelForThread(threadId);

    // Check if effective model belongs to a disabled route
    const effectiveModelValid = effectiveModel
      ? availableModels.some(m => m.id === effectiveModel)
      : false;

    return NextResponse.json({
      threadId,
      selectedModel: dbThread?.selected_model || null,
      effectiveModel,
      effectiveModelValid,
      globalDefault,
      availableModels,
    });
  } catch (error) {
    console.error('[API] Error getting thread model:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to get thread model', code: 'SERVICE_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/threads/[threadId]/model
 *
 * Update thread's model selection
 * Body: { modelId: string | null }
 *   - NULL = reset to global default
 *   - string = set specific model override
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { threadId } = await params;

    // Use getThread which handles ownership verification internally
    const thread = await getThread(user.id, threadId);
    if (!thread) {
      return NextResponse.json<ApiError>(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { modelId } = body;

    // Validate model exists if not NULL
    if (modelId !== null && modelId !== undefined) {
      const model = await getEnabledModel(modelId);

      if (!model) {
        return NextResponse.json<ApiError>(
          {
            error: `Model '${modelId}' not found in available models`,
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }

      if (!model.enabled) {
        return NextResponse.json<ApiError>(
          {
            error: `Model '${modelId}' is currently disabled`,
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
    }

    // Update thread model
    const success = await updateThreadModel(threadId, modelId || null);

    if (!success) {
      return NextResponse.json<ApiError>(
        { error: 'Failed to update thread model', code: 'SERVICE_ERROR' },
        { status: 500 }
      );
    }

    // Get updated effective model
    const effectiveModel = await getEffectiveModelForThread(threadId);

    return NextResponse.json({
      success: true,
      threadId,
      selectedModel: modelId || null,
      effectiveModel,
    });
  } catch (error) {
    console.error('[API] Error updating thread model:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to update thread model', code: 'SERVICE_ERROR' },
      { status: 500 }
    );
  }
}
