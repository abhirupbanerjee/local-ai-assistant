import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRerankerSettings } from '@/lib/db/compat/config';
import { getApiKey } from '@/lib/provider-helpers';
import type { ApiError } from '@/types';

/**
 * Test a reranker provider's availability
 * POST /api/admin/settings/reranker/test
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json<ApiError>(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json<ApiError>(
        { error: 'Provider is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const validProviders = ['ollama', 'bge-large', 'bge-base', 'local', 'cohere', 'fireworks'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json<ApiError>(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    let available = false;
    let error: string | undefined;

    try {
      switch (provider) {
        case 'ollama': {
          // Test Ollama connection
          const { getApiBase } = await import('@/lib/provider-helpers');
          const apiBase = await getApiBase('ollama');
          const ollamaUrl = (apiBase || 'http://localhost:11434').replace(/\/v1\/?$/, '');
          
          const response = await fetch(`${ollamaUrl}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`Ollama server returned ${response.status}`);
          }

          const data = await response.json() as { models?: Array<{ name: string }> };
          const hasRerankerModel = data.models?.some(m => 
            m.name.includes('reranker') || m.name.includes('bge')
          );

          available = true;
          if (!hasRerankerModel) {
            error = 'Ollama is running but no reranker model found. Run: ollama pull bbjson/bge-reranker-base';
          }
          break;
        }

        case 'bge-large':
        case 'bge-base': {
          // Test BGE by attempting to load the pipeline
          try {
            const { pipeline, env } = await import('@xenova/transformers');
            env.cacheDir = process.env.TRANSFORMERS_CACHE || '/tmp/transformers_cache';
            env.allowLocalModels = false;

            const modelId = provider === 'bge-large' 
              ? 'Xenova/bge-reranker-large' 
              : 'Xenova/bge-reranker-base';

            // Try to load the model (this will download if not cached)
            const testPipeline = await pipeline('text-classification', modelId, { 
              quantized: true,
              // Use a short timeout for testing
              revision: 'main',
            });

            // Test with a simple input
            const result = await testPipeline('test query [SEP] test document');
            
            available = true;
          } catch (err) {
            throw new Error(`Failed to load BGE model: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
          break;
        }

        case 'local': {
          // Test local bi-encoder
          try {
            const { pipeline, env } = await import('@xenova/transformers');
            env.cacheDir = process.env.TRANSFORMERS_CACHE || '/tmp/transformers_cache';
            env.allowLocalModels = false;

            const testPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
              quantized: true,
            });

            // Test with a simple input
            const result = await testPipeline('test query', { pooling: 'mean', normalize: true });
            
            available = true;
          } catch (err) {
            throw new Error(`Failed to load local model: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
          break;
        }

        case 'cohere': {
          // Test Cohere API
          const settings = await getRerankerSettings();
          const apiKey = settings.cohereApiKey || process.env.COHERE_API_KEY;

          if (!apiKey) {
            throw new Error('Cohere API key not configured');
          }

          const { CohereClient } = await import('cohere-ai');
          const client = new CohereClient({ token: apiKey });

          // Test with a simple rerank call
          const response = await client.rerank({
            query: 'test query',
            documents: [{ text: 'test document' }],
            model: 'rerank-english-v3.0',
            topN: 1,
          });

          available = true;
          break;
        }

        case 'fireworks': {
          // Test Fireworks API
          const apiKey = await getApiKey('fireworks');
          
          if (!apiKey) {
            throw new Error('Fireworks API key not configured');
          }

          const response = await fetch('https://api.fireworks.ai/inference/v1/rerank', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'accounts/fireworks/models/qwen3-reranker-8b',
              query: 'test query',
              documents: ['test document'],
              top_n: 1,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Fireworks API returned ${response.status}: ${errorText}`);
          }

          available = true;
          break;
        }
      }
    } catch (err) {
      available = false;
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    }

    const latency = Date.now() - startTime;

    return NextResponse.json({
      provider,
      available,
      latency,
      error,
    });

  } catch (error) {
    console.error('[Reranker Test] Error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to test reranker provider',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}