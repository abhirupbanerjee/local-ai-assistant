import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getApiBase } from '@/lib/provider-helpers';

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
    
    // Transform to simpler format
    const models = (data.models || []).map((m: { name: string; size?: number; modified_at?: string; digest?: string; details?: Record<string, unknown> }) => ({
      name: m.name,
      model: m.name,
      size: m.size || 0,
      digest: m.digest || '',
      modifiedAt: m.modified_at,
      details: m.details,
    }));

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
