/**
 * Ollama Cloud Service
 *
 * Handles discovery and management of Ollama Cloud models.
 * Ollama Cloud allows running models in the cloud without local GPU.
 *
 * API Documentation:
 * - Base URL: https://ollama.com/api
 * - Authentication: Bearer token via OLLAMA_API_KEY
 * - Models with -cloud suffix run on Ollama's cloud infrastructure
 */

import { getProviderApiKey } from '../db/compat/llm-providers';
import { getDb } from '../db/kysely';

// ============ Types ============

export interface OllamaCloudModel {
  id: string;
  name: string;
  tag: string;
  size: number;
  digest: string;
  modified_at: string;
  is_cloud: boolean;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaCloudDiscoveryResult {
  success: boolean;
  models: OllamaCloudModel[];
  error?: string;
}

export interface CloudModelConfig {
  id: string;
  displayName: string;
  providerId: string;
  toolCapable: boolean;
  visionCapable: boolean;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  isCloud: boolean;
  enabled: boolean;
}

// ============ Constants ============

const OLLAMA_CLOUD_BASE_URL = 'https://ollama.com/api';

// Model capability detection patterns
const VISION_PATTERNS = ['vl', 'vision', 'multimodal', 'qvq'];
const TOOL_PATTERNS = ['coder', 'code', 'instruct', 'chat'];

// Known model capabilities (for models where name-based detection may be inaccurate)
const KNOWN_MODEL_CAPABILITIES: Record<string, { toolCapable: boolean; visionCapable: boolean }> = {
  // Vision models
  'qwen3-vl:235b': { toolCapable: true, visionCapable: true },
  'qwen3-vl:235b-instruct': { toolCapable: true, visionCapable: true },
  // Code/Tool models
  'qwen3-coder:480b': { toolCapable: true, visionCapable: false },
  'qwen3-coder-next': { toolCapable: true, visionCapable: false },
  'devstral-small-2:24b': { toolCapable: true, visionCapable: false },
  'devstral-2:123b': { toolCapable: true, visionCapable: false },
  // General models (tool capable)
  'deepseek-v3.2': { toolCapable: true, visionCapable: false },
  'deepseek-v4-flash': { toolCapable: true, visionCapable: false },
  'deepseek-v3.1:671b': { toolCapable: true, visionCapable: false },
  'gemma3:4b': { toolCapable: true, visionCapable: false },
  'gemma3:12b': { toolCapable: true, visionCapable: false },
  'gemma3:27b': { toolCapable: true, visionCapable: false },
  'gemma4:31b': { toolCapable: true, visionCapable: false },
  'gpt-oss:20b': { toolCapable: true, visionCapable: false },
  'gpt-oss:120b': { toolCapable: true, visionCapable: false },
  'glm-4.6': { toolCapable: true, visionCapable: false },
  'glm-4.7': { toolCapable: true, visionCapable: false },
  'glm-5': { toolCapable: true, visionCapable: false },
  'glm-5.1': { toolCapable: true, visionCapable: false },
  'kimi-k2.5': { toolCapable: true, visionCapable: false },
  'kimi-k2.6': { toolCapable: true, visionCapable: false },
  'kimi-k2:1t': { toolCapable: true, visionCapable: false },
  'kimi-k2-thinking': { toolCapable: true, visionCapable: false },
  'minimax-m2': { toolCapable: true, visionCapable: false },
  'minimax-m2.1': { toolCapable: true, visionCapable: false },
  'minimax-m2.5': { toolCapable: true, visionCapable: false },
  'minimax-m2.7': { toolCapable: true, visionCapable: false },
  'mistral-large-3:675b': { toolCapable: true, visionCapable: false },
  'nemotron-3-nano:30b': { toolCapable: true, visionCapable: false },
  'nemotron-3-super': { toolCapable: true, visionCapable: false },
  'cogito-2.1:671b': { toolCapable: true, visionCapable: false },
  'qwen3-next:80b': { toolCapable: true, visionCapable: false },
  'qwen3.5:397b': { toolCapable: true, visionCapable: false },
  'gemini-3-flash-preview': { toolCapable: true, visionCapable: true },
  'ministral-3:3b': { toolCapable: true, visionCapable: false },
  'ministral-3:8b': { toolCapable: true, visionCapable: false },
  'ministral-3:14b': { toolCapable: true, visionCapable: false },
};

// Helper to detect capabilities from model name
function detectCapabilities(modelName: string): { toolCapable: boolean; visionCapable: boolean } {
  const name = modelName.toLowerCase();
  
  // Check known models first
  if (KNOWN_MODEL_CAPABILITIES[modelName]) {
    return KNOWN_MODEL_CAPABILITIES[modelName];
  }
  
  // Detect from name patterns
  const visionCapable = VISION_PATTERNS.some(p => name.includes(p));
  const toolCapable = TOOL_PATTERNS.some(p => name.includes(p)) || !visionCapable; // Most models are tool capable
  
  return { toolCapable, visionCapable };
}

// Helper to format model name for display
function formatModelName(modelId: string): string {
  // Convert model ID to display name
  // e.g., "deepseek-v3.2" -> "DeepSeek V3.2"
  return modelId
    .split(':')[0] // Remove tag
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/(\d+)/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============ API Functions ============

/**
 * Get Ollama Cloud API key from database or environment
 */
export async function getOllamaCloudApiKey(): Promise<string | null> {
  // First check database
  const dbKey = await getProviderApiKey('ollama-cloud');
  if (dbKey) return dbKey;

  // Fall back to environment variable
  return process.env.OLLAMA_API_KEY || null;
}

/**
 * Check if Ollama Cloud is configured (has API key)
 */
export async function isOllamaCloudConfigured(): Promise<boolean> {
  return !!(await getOllamaCloudApiKey());
}

/**
 * Fetch available cloud models from Ollama Cloud API
 */
export async function discoverOllamaCloudModels(): Promise<OllamaCloudDiscoveryResult> {
  const apiKey = await getOllamaCloudApiKey();

  if (!apiKey) {
    return {
      success: false,
      models: [],
      error: 'OLLAMA_API_KEY not configured. Please add your Ollama Cloud API key in Settings > LLM.',
    };
  }

  try {
    // Use native Ollama /tags endpoint
    const response = await fetch(`${OLLAMA_CLOUD_BASE_URL}/tags`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          models: [],
          error: 'Invalid Ollama Cloud API key. Please check your credentials.',
        };
      }
      throw new Error(`Ollama Cloud API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Native Ollama /tags returns { models: [{ name, model, size, digest, modified_at, details }] }
    const cloudModels: OllamaCloudModel[] = (data.models || []).map((model: { name: string; model: string; size?: number; digest?: string; modified_at?: string; details?: { format: string; family: string; parameter_size: string; quantization_level: string } }) => ({
      id: model.name || model.model,
      name: formatModelName(model.name || model.model),
      tag: (model.name || model.model).split(':')[1] || 'latest',
      size: model.size || 0,
      digest: model.digest || '',
      modified_at: model.modified_at || new Date().toISOString(),
      is_cloud: true,
      details: model.details,
    }));

    return {
      success: true,
      models: cloudModels,
    };
  } catch (error) {
    console.error('[Ollama Cloud] Discovery error:', error);
    return {
      success: false,
      models: [],
      error: error instanceof Error ? error.message : 'Failed to discover Ollama Cloud models',
    };
  }
}

/**
 * Test connection to Ollama Cloud
 */
export async function testOllamaCloudConnection(): Promise<{ success: boolean; error?: string }> {
  const apiKey = await getOllamaCloudApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: 'OLLAMA_API_KEY not configured',
    };
  }

  try {
    // Use native Ollama /tags endpoint
    const response = await fetch(`${OLLAMA_CLOUD_BASE_URL}/tags`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API returned ${response.status}: ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// ============ Database Operations ============

interface CloudModelRow {
  id: string;
  provider_id: string;
  display_name: string;
  tool_capable: number;
  vision_capable: number;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  is_cloud: number;
  enabled: number;
}

/**
 * Get all cloud models from database (enabled and disabled)
 */
export async function getAllCloudModels(): Promise<CloudModelConfig[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom('enabled_models')
    .select([
      'id',
      'provider_id',
      'display_name',
      'tool_capable',
      'vision_capable',
      'max_input_tokens',
      'max_output_tokens',
      'is_cloud',
      'enabled',
    ])
    .where('provider_id', '=', 'ollama-cloud')
    .where('is_cloud', '=', 1)
    .orderBy('display_name')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    providerId: row.provider_id,
    toolCapable: row.tool_capable === 1,
    visionCapable: row.vision_capable === 1,
    maxInputTokens: row.max_input_tokens,
    maxOutputTokens: row.max_output_tokens,
    isCloud: row.is_cloud === 1,
    enabled: row.enabled === 1,
  }));
}

/**
 * Get all enabled cloud models from database
 */
export async function getEnabledCloudModels(): Promise<CloudModelConfig[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom('enabled_models')
    .select([
      'id',
      'provider_id',
      'display_name',
      'tool_capable',
      'vision_capable',
      'max_input_tokens',
      'max_output_tokens',
      'is_cloud',
      'enabled',
    ])
    .where('provider_id', '=', 'ollama-cloud')
    .where('is_cloud', '=', 1)
    .where('enabled', '=', 1)
    .orderBy('display_name')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    providerId: row.provider_id,
    toolCapable: row.tool_capable === 1,
    visionCapable: row.vision_capable === 1,
    maxInputTokens: row.max_input_tokens,
    maxOutputTokens: row.max_output_tokens,
    isCloud: row.is_cloud === 1,
    enabled: row.enabled === 1,
  }));
}

/**
 * Enable a cloud model in the database
 */
export async function enableCloudModel(modelId: string, displayName?: string): Promise<boolean> {
  const name = displayName || modelId;
  const db = await getDb();

  // Check if model already exists
  const existing = await db
    .selectFrom('enabled_models')
    .select('id')
    .where('id', '=', modelId)
    .executeTakeFirst();

  if (existing) {
    // Update existing model
    await db
      .updateTable('enabled_models')
      .set({ enabled: 1, is_cloud: 1, display_name: name })
      .where('id', '=', modelId)
      .execute();
  } else {
    // Insert new model
    await db
      .insertInto('enabled_models')
      .values({
        id: modelId,
        provider_id: 'ollama-cloud',
        display_name: name,
        tool_capable: 1,
        vision_capable: 0,
        is_cloud: 1,
        enabled: 1,
      })
      .execute();
  }

  return true;
}

/**
 * Disable a cloud model in the database
 */
export async function disableCloudModel(modelId: string): Promise<boolean> {
  const db = await getDb();
  await db
    .updateTable('enabled_models')
    .set({ enabled: 0 })
    .where('id', '=', modelId)
    .where('provider_id', '=', 'ollama-cloud')
    .execute();
  return true;
}

/**
 * Enable all cloud models in the database
 */
export async function enableAllCloudModels(): Promise<number> {
  const db = await getDb();
  const result = await db
    .updateTable('enabled_models')
    .set({ enabled: 1 })
    .where('provider_id', '=', 'ollama-cloud')
    .where('is_cloud', '=', 1)
    .execute();
  return result.length;
}

/**
 * Disable all cloud models in the database
 */
export async function disableAllCloudModels(): Promise<number> {
  const db = await getDb();
  const result = await db
    .updateTable('enabled_models')
    .set({ enabled: 0 })
    .where('provider_id', '=', 'ollama-cloud')
    .where('is_cloud', '=', 1)
    .execute();
  return result.length;
}

/**
 * Sync discovered cloud models to database
 * Returns count of newly added models
 * New models are disabled by default - user must explicitly enable them
 */
export async function syncCloudModelsToDatabase(models: OllamaCloudModel[]): Promise<number> {
  const db = await getDb();
  let addedCount = 0;

  for (const model of models) {
    // Check if model exists
    const existing = await db
      .selectFrom('enabled_models')
      .select('id')
      .where('id', '=', model.id)
      .executeTakeFirst();

    if (!existing) {
      // Get capabilities for this model
      const capabilities = detectCapabilities(model.id);

      await db
        .insertInto('enabled_models')
        .values({
          id: model.id,
          provider_id: 'ollama-cloud',
          display_name: model.name,
          tool_capable: capabilities.toolCapable ? 1 : 0,
          vision_capable: capabilities.visionCapable ? 1 : 0,
          is_cloud: 1,
          enabled: 0, // Disabled by default - user must explicitly enable
        })
        .execute();

      addedCount++;
    }
  }

  return addedCount;
}

/**
 * Batch update enabled status for multiple models
 * Returns count of updated models
 */
export async function batchUpdateModelStatus(updates: Array<{ modelId: string; enabled: boolean }>): Promise<number> {
  const db = await getDb();
  let updatedCount = 0;

  for (const { modelId, enabled } of updates) {
    const result = await db
      .updateTable('enabled_models')
      .set({ enabled: enabled ? 1 : 0 })
      .where('id', '=', modelId)
      .where('provider_id', '=', 'ollama-cloud')
      .execute();
    
    if (result.length > 0) {
      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Get cloud model usage statistics
 */
export async function getCloudModelUsage(modelId?: string): Promise<Array<{
  model: string;
  totalTokens: number;
  requestCount: number;
  lastUsed: string;
}>> {
  const db = await getDb();

  let query = db
    .selectFrom('token_usage_log')
    .select([
      'model',
      db.fn.sum<number>('total_tokens').as('total_tokens'),
      db.fn.count<number>('id').as('request_count'),
      db.fn.max('created_at').as('last_used'),
    ])
    .where('category', '=', 'chat')
    .groupBy('model');

  if (modelId) {
    query = query.where('model', '=', modelId);
  } else {
    query = query.where('model', 'like', '%-cloud%');
  }

  const rows = await query.orderBy('total_tokens', 'desc').execute();

  return rows.map((row) => ({
    model: row.model,
    totalTokens: row.total_tokens ?? 0,
    requestCount: Number(row.request_count),
    lastUsed: row.last_used ?? '',
  }));
}