import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getActiveModels, getAllEnabledModels, getModelsByProvider } from '@/lib/db/compat/enabled-models';
import { getRoutesSettings } from '@/lib/db/compat/config';

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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for provider filter query parameter
  const { searchParams } = new URL(request.url);
  const providerFilter = searchParams.get('provider');

  // If provider filter is specified, return models for that provider only
  if (providerFilter) {
    const models = await getModelsByProvider(providerFilter);
    return NextResponse.json({ models });
  }

  // Otherwise return active models filtered by route settings
  const models = await getActiveModels();
  const routesSettings = await getRoutesSettings();

  // Filter models by active routes using provider_id
  const filteredModels = models.filter(m => {
    // Use provider_id for accurate route determination
    const route = getModelRoute(m.providerId);
    if (route === 'route3') return routesSettings.route3Enabled;
    if (route === 'route2') return routesSettings.route2Enabled;
    return routesSettings.route1Enabled;
  });

  return NextResponse.json({ models: filteredModels });
}
