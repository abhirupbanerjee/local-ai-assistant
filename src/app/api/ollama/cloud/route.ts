/**
 * Ollama Cloud API Routes
 *
 * Endpoints for discovering, enabling, and managing Ollama Cloud models.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  discoverOllamaCloudModels,
  testOllamaCloudConnection,
  isOllamaCloudConfigured,
  getEnabledCloudModels,
  getAllCloudModels,
  enableCloudModel,
  disableCloudModel,
  syncCloudModelsToDatabase,
  getCloudModelUsage,
} from '@/lib/services/ollama-cloud';

/**
 * GET /api/ollama/cloud
 * Get Ollama Cloud status and enabled models
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'discover':
        // Discover available cloud models from Ollama Cloud API
        const discoveryResult = await discoverOllamaCloudModels();
        return NextResponse.json(discoveryResult);

      case 'test':
        // Test connection to Ollama Cloud
        const testResult = await testOllamaCloudConnection();
        return NextResponse.json(testResult);

      case 'usage':
        // Get usage statistics for cloud models
        const modelId = searchParams.get('model') || undefined;
        const usage = await getCloudModelUsage(modelId);
        return NextResponse.json({ usage });

      case 'models':
        // Get all cloud models from database (enabled and disabled)
        const allModels = await getAllCloudModels();
        return NextResponse.json({
          configured: await isOllamaCloudConfigured(),
          models: allModels,
        });

      case 'status':
      default:
        // Get current status and enabled models
        const isConfigured = await isOllamaCloudConfigured();
        const enabledModels = await getEnabledCloudModels();
        return NextResponse.json({
          configured: isConfigured,
          enabledModels,
        });
    }
  } catch (error) {
    console.error('[Ollama Cloud API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get Ollama Cloud status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ollama/cloud
 * Enable, disable, or sync cloud models
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, modelId, displayName, models } = body;

    switch (action) {
      case 'enable':
        if (!modelId) {
          return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
        }
        await enableCloudModel(modelId, displayName);
        return NextResponse.json({ success: true, message: `Model ${modelId} enabled` });

      case 'disable':
        if (!modelId) {
          return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
        }
        await disableCloudModel(modelId);
        return NextResponse.json({ success: true, message: `Model ${modelId} disabled` });

      case 'sync':
        // Sync discovered models to database
        const modelsToSync = models || [];
        const addedCount = await syncCloudModelsToDatabase(modelsToSync);
        return NextResponse.json({
          success: true,
          addedCount,
          message: `Synced ${addedCount} new cloud models`,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Ollama Cloud API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update Ollama Cloud models' },
      { status: 500 }
    );
  }
}