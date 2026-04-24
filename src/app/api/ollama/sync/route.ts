import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getApiBase } from '@/lib/provider-helpers';
import { discoverModels } from '@/lib/services/model-discovery';
import {
  getEnabledModel,
  createEnabledModel,
  enableModel,
} from '@/lib/db/compat/enabled-models';

/**
 * POST /api/ollama/sync
 * 
 * Sync Ollama models from the local Ollama instance to the enabled_models database
 * This makes them available in the chat model selector
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const ollamaBase = await getApiBase('ollama');
    if (!ollamaBase) {
      return NextResponse.json(
        { error: 'Ollama not configured' },
        { status: 500 }
      );
    }

    // Discover models from Ollama
    const result = await discoverModels('ollama');
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to discover Ollama models' },
        { status: 500 }
      );
    }

    const discoveredModels = result.models;
    const synced: string[] = [];
    const enabled: string[] = [];
    const errors: string[] = [];

    for (const model of discoveredModels) {
      try {
        const existing = await getEnabledModel(model.id);
        
        if (!existing) {
          // Create new enabled model
          await createEnabledModel({
            id: model.id,
            providerId: 'ollama',
            displayName: model.name,
            toolCapable: model.toolCapable,
            visionCapable: model.visionCapable,
            maxInputTokens: model.maxInputTokens ?? undefined,
            maxOutputTokens: model.maxOutputTokens,
            enabled: true,
          });
          synced.push(model.id);
        } else if (!existing.enabled) {
          // Re-enable if it was disabled
          await enableModel(model.id);
          enabled.push(model.id);
        }
      } catch (error) {
        errors.push(`${model.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      enabled,
      errors: errors.length > 0 ? errors : undefined,
      totalDiscovered: discoveredModels.length,
    });
  } catch (error) {
    console.error('[Ollama Sync] Failed to sync models:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync models' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ollama/sync
 * 
 * Check which Ollama models are discovered but not yet synced to the database
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const ollamaBase = await getApiBase('ollama');
    if (!ollamaBase) {
      return NextResponse.json(
        { error: 'Ollama not configured' },
        { status: 500 }
      );
    }

    // Discover models from Ollama
    const result = await discoverModels('ollama');
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to discover Ollama models' },
        { status: 500 }
      );
    }

    const discoveredModels = result.models;
    const unsynced: string[] = [];
    const synced: string[] = [];

    for (const model of discoveredModels) {
      const existing = await getEnabledModel(model.id);
      if (!existing || !existing.enabled) {
        unsynced.push(model.id);
      } else {
        synced.push(model.id);
      }
    }

    return NextResponse.json({
      discovered: discoveredModels.map(m => ({ id: m.id, name: m.name })),
      unsynced,
      synced,
      totalDiscovered: discoveredModels.length,
      totalUnsynced: unsynced.length,
    });
  } catch (error) {
    console.error('[Ollama Sync] Failed to check sync status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check sync status' },
      { status: 500 }
    );
  }
}