import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getApiBase } from '@/lib/provider-helpers';
import { getEnabledModel, enableModel, disableModel } from '@/lib/db/compat/enabled-models';

/**
 * GET /api/ollama/models
 * 
 * Get list of installed models from Ollama
 * Calls: GET http://localhost:11434/api/tags
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const ollamaBase = await getApiBase('ollama');
    if (!ollamaBase) {
      return NextResponse.json({ 
        error: 'Ollama not configured',
        models: [],
        status: { connected: false, mode: 'docker', error: 'Ollama not configured' }
      }, { status: 500 });
    }

    const response = await fetch(`${ollamaBase}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      const mode = process.env.OLLAMA_MODE?.toLowerCase() || 'docker';
      return NextResponse.json(
        { 
          error: `Ollama API error: ${response.status} - ${errorText}`,
          models: [],
          status: { connected: false, mode: mode as 'docker' | 'system', error: `Ollama API error: ${response.status}` }
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const mode = process.env.OLLAMA_MODE?.toLowerCase() || 'docker';
    
    // Transform to simpler format and include enabled status
    const models = await Promise.all(
      (data.models || []).map(async (m: { name: string; size?: number; modified_at?: string; digest?: string; details?: Record<string, unknown> }) => {
        const enabledModel = await getEnabledModel(m.name);
        return {
          name: m.name,
          model: m.name,
          size: m.size || 0,
          digest: m.digest || '',
          modifiedAt: m.modified_at,
          details: m.details,
          isEnabled: enabledModel?.enabled ?? false,
        };
      })
    );

    return NextResponse.json({ 
      models,
      status: { connected: true, mode: mode as 'docker' | 'system' }
    });
  } catch (error) {
    console.error('[Ollama Models] Failed to fetch models:', error);
    const mode = process.env.OLLAMA_MODE?.toLowerCase() || 'docker';
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch models',
        models: [],
        status: { connected: false, mode: mode as 'docker' | 'system', error: error instanceof Error ? error.message : 'Failed to fetch models' }
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ollama/models
 * 
 * Enable or disable a model in the enabled_models database
 * Body: { model: string, enabled: boolean }
 */
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { model, enabled } = body;

    if (!model || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Model name and enabled boolean required' }, { status: 400 });
    }

    const existingModel = await getEnabledModel(model);
    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found in enabled_models' }, { status: 404 });
    }

    if (enabled) {
      await enableModel(model);
    } else {
      await disableModel(model);
    }

    return NextResponse.json({ 
      success: true, 
      model,
      enabled,
      message: `Model ${model} ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('[Ollama Models] Failed to update model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update model' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ollama/models
 * 
 * Delete a model from Ollama
 * Body: { model: string }
 * Calls: DELETE http://localhost:11434/api/delete
 */
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { model } = body;

    if (!model) {
      return NextResponse.json({ error: 'Model name required' }, { status: 400 });
    }

    const ollamaBase = await getApiBase('ollama');
    if (!ollamaBase) {
      return NextResponse.json({ error: 'Ollama not configured' }, { status: 500 });
    }

    // Delete from Ollama
    const response = await fetch(`${ollamaBase}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Ollama API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Also disable in enabled_models if it exists
    const existingModel = await getEnabledModel(model);
    if (existingModel) {
      await disableModel(model);
    }

    return NextResponse.json({ 
      success: true, 
      model,
      message: `Model ${model} deleted from Ollama`
    });
  } catch (error) {
    console.error('[Ollama Models] Failed to delete model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete model' },
      { status: 500 }
    );
  }
}