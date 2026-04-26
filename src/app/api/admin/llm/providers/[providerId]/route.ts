import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateProvider, getProvider, isProviderConfigured } from '@/lib/db/compat/llm-providers';
import { setRoutesSettings, getRoutesSettings } from '@/lib/db/compat/config';
import { safeEncrypt } from '@/lib/encryption';
import type { ApiError } from '@/types';

/**
 * PUT /api/admin/llm/providers/[providerId]
 * Update a provider's API key or base URL
 */
export async function PUT(
  request: NextRequest,
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

    if (!user.isAdmin) {
      return NextResponse.json<ApiError>(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    const { providerId } = await params;
    const body = await request.json();
    const { apiKey, apiBase } = body;

    // Validate input
    if (apiKey !== undefined && typeof apiKey !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'API key must be a string', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (apiBase !== undefined && typeof apiBase !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'API base must be a string', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Check if provider exists
    const existing = await getProvider(providerId);
    if (!existing) {
      return NextResponse.json<ApiError>(
        { error: 'Provider not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Prepare update object
    const updateData: { apiKey?: string; apiBase?: string } = {};
    
    // Encrypt API key before storing (if provided and not masked)
    if (apiKey !== undefined && apiKey && !apiKey.includes('•')) {
      updateData.apiKey = safeEncrypt(apiKey) || apiKey;
    } else if (apiKey === '') {
      // Clear the API key
      updateData.apiKey = '';
    }

    // Store API base URL (for Ollama)
    if (apiBase !== undefined) {
      updateData.apiBase = apiBase || undefined;
    }

    // Update the provider
    const updated = await updateProvider(providerId, updateData);

    // Auto-enable Route 3 if ollama or ollama-cloud gets configured
    if ((providerId === 'ollama' || providerId === 'ollama-cloud') && 
        (updateData.apiKey || updateData.apiBase)) {
      const routesSettings = await getRoutesSettings();
      if (!routesSettings.route3Enabled) {
        console.log(`[LLM Providers] Auto-enabling Route 3 for ${providerId}`);
        await setRoutesSettings({
          ...routesSettings,
          route3Enabled: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      provider: {
        id: updated?.id,
        name: updated?.name,
        apiKey: updated?.apiKey ? '••••••••' : '',
        apiBase: updated?.apiBase,
        enabled: updated?.enabled,
      },
    });
  } catch (error) {
    console.error('Update LLM provider error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to update provider',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}