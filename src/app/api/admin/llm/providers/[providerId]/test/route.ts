import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProvider } from '@/lib/db/compat/llm-providers';
import { getApiKey, getApiBase } from '@/lib/provider-helpers';
import type { ApiError } from '@/types';

/**
 * POST /api/admin/llm/providers/[providerId]/test
 * Test a provider's connection
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> }
) {
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

    const { providerId } = await params;

    // Check if provider exists
    const provider = await getProvider(providerId);
    if (!provider) {
      return NextResponse.json<ApiError>(
        { error: 'Provider not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get API key (from DB or env)
    const apiKey = await getApiKey(providerId);
    const apiBase = await getApiBase(providerId);

    // Test connection based on provider type
    let testResult: { success: boolean; message: string };

    switch (providerId) {
      case 'ollama':
        testResult = await testOllamaConnection(apiBase);
        break;
      case 'ollama-cloud':
        testResult = await testOllamaCloudConnection(apiKey);
        break;
      case 'fireworks':
        testResult = await testFireworksConnection(apiKey);
        break;
      default:
        testResult = { success: false, message: `No test implemented for provider: ${providerId}` };
    }

    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      provider: providerId,
    });
  } catch (error) {
    console.error('Test LLM provider error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to test provider',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Test Ollama local connection
 */
async function testOllamaConnection(apiBase: string | null): Promise<{ success: boolean; message: string }> {
  const baseUrl = apiBase || process.env.OLLAMA_API_BASE || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      const modelCount = data.models?.length || 0;
      return {
        success: true,
        message: `Connected successfully. ${modelCount} model(s) available.`,
      };
    }
    return {
      success: false,
      message: `Connection failed: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Test Ollama Cloud connection
 */
async function testOllamaCloudConnection(apiKey: string | null): Promise<{ success: boolean; message: string }> {
  if (!apiKey) {
    return { success: false, message: 'No API key configured' };
  }

  try {
    // Ollama Cloud uses OpenAI-compatible API at https://api.ollama.com/v1
    const response = await fetch('https://api.ollama.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      const modelCount = data.data?.length || 0;
      return {
        success: true,
        message: `Connected successfully. ${modelCount} model(s) available.`,
      };
    }
    
    // Handle specific error codes
    if (response.status === 401) {
      return { success: false, message: 'Invalid API key' };
    }
    
    return {
      success: false,
      message: `Connection failed: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Test Fireworks AI connection
 */
async function testFireworksConnection(apiKey: string | null): Promise<{ success: boolean; message: string }> {
  if (!apiKey) {
    return { success: false, message: 'No API key configured' };
  }

  try {
    const response = await fetch('https://api.fireworks.ai/inference/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      const modelCount = data.data?.length || 0;
      return {
        success: true,
        message: `Connected successfully. ${modelCount} model(s) available.`,
      };
    }
    
    if (response.status === 401) {
      return { success: false, message: 'Invalid API key' };
    }
    
    return {
      success: false,
      message: `Connection failed: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}