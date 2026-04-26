import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllProviders, isProviderConfigured } from '@/lib/db/compat/llm-providers';
import { getApiKey, getApiBase } from '@/lib/provider-helpers';
import type { ApiError } from '@/types';

interface LLMProviderResponse {
  id: string;
  name: string;
  apiKey: string;
  apiBase: string | null;
  enabled: boolean;
  apiKeyConfigured: boolean;
  apiKeyFromEnv: boolean;
}

/**
 * GET /api/admin/llm/providers
 * List all LLM providers with their configuration status
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin' && user.role !== 'superuser') {
      return NextResponse.json<ApiError>(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    const providers = await getAllProviders();
    
    // Build response with configuration status
    const response: LLMProviderResponse[] = await Promise.all(
      providers.map(async (p) => {
        const hasStoredKey = !!p.apiKey;
        const hasStoredBase = !!p.apiBase;
        
        // Check if key is available from env
        let apiKeyFromEnv = false;
        let apiBaseFromEnv = false;
        
        if (p.id === 'ollama-cloud') {
          apiKeyFromEnv = !!process.env.OLLAMA_API_KEY;
        } else if (p.id === 'fireworks') {
          apiKeyFromEnv = !!process.env.FIREWORKS_AI_API_KEY;
        } else if (p.id === 'ollama') {
          apiBaseFromEnv = !!process.env.OLLAMA_API_BASE;
        }
        
        // Check if provider is configured (has key or base)
        const isConfigured = await isProviderConfigured(p.id);
        
        return {
          id: p.id,
          name: p.name,
          // Show masked key if exists, empty string otherwise
          apiKey: hasStoredKey ? '••••••••••••••••' : '',
          apiBase: p.apiBase || null,
          enabled: p.enabled,
          apiKeyConfigured: hasStoredKey || hasStoredBase,
          apiKeyFromEnv: apiKeyFromEnv || apiBaseFromEnv,
        };
      })
    );

    return NextResponse.json({ providers: response });
  } catch (error) {
    console.error('Get LLM providers error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to get providers',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}