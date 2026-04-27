/**
 * Model Discovery Service
 *
 * Discovers available models from LLM provider APIs (Ollama, Fireworks)
 */

import { getProviderApiKey, getProviderApiBase } from '../db/compat/llm-providers';
import { getEnabledModel } from '../db/compat/enabled-models';

/**
 * Generate a display name from a model ID
 * Converts technical IDs to user-friendly names
 */
function generateDisplayName(modelId: string): string {
  // Remove common prefixes
  let name = modelId
    .replace(/^ollama-/, '')
    .replace(/^ollama\//, '')
    .replace(/^litellm\//, '')
    .replace(/^fireworks\//, '')
    .replace(/^accounts\/fireworks\/models\//, '');

  // Convert kebab-case to Title Case
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============ Types ============

export interface DiscoveredModel {
  id: string;
  name: string;           // Display name
  provider: string;       // 'ollama', 'fireworks'
  toolCapable: boolean;
  visionCapable: boolean;
  maxInputTokens: number | null;
  maxOutputTokens: number;  // Provider-based default or API value
  isEnabled: boolean;     // Already enabled in Local AI Assistant
}

export interface DiscoveryResult {
  success: boolean;
  provider: string;
  models: DiscoveredModel[];
  error?: string;
}

// ============ Known Model Capabilities ============

// Models known to support function calling
const TOOL_CAPABLE_PATTERNS = [
  // Ollama (some models)
  /^llama3/,
  /^qwen/,
  /^mistral/,
  /^gpt-oss/,
  // Fireworks models
  /^fireworks\//,
];

// Models known to support vision/images
const VISION_CAPABLE_PATTERNS = [
  // Ollama multimodal models
  /^qwen3\.5/,
  /^qwen\d?(\.\d+)?-vl/,
  // Fireworks vision models
  /qwen3p6-plus/,
];

// Models known to reliably handle parallel tool calls (multiple tool_calls in one response)
const PARALLEL_TOOL_CAPABLE_PATTERNS = [
  // Fireworks-hosted models (MiniMax, Kimi, etc.)
  /^fireworks\//,
  /^accounts\/fireworks/,
];

// Models known to support thinking/reasoning content
const THINKING_CAPABLE_PATTERNS = [
  // Think-tag models — parsed via parseThinkChunk()
  /^qwen3/,
  /^qwq/,
];

// Known context window sizes
const CONTEXT_WINDOWS: Record<string, number> = {
  // Ollama models
  'llama3.2:3b': 131072,
  'qwen3.5:0.8b': 131072,
  'qwen3.5:2b': 131072,
  'ministral-3:3b': 131072,
  'gpt-oss:20b': 131072,
  // Fireworks models
  'fireworks/kimi-k2p6': 131072,
  'fireworks/minimax-m2p7': 131072,
  'fireworks/qwen3p6-plus': 131072,
  'fireworks/glm-5p1': 131072,
  'fireworks/gpt-oss-120b': 131072,
};

// Provider-specific default output token limits
const DEFAULT_OUTPUT_TOKENS: Record<string, number> = {
  ollama: 2000,
  fireworks: 16000,
};

/**
 * Get default max output tokens for a provider
 */
export function getDefaultOutputTokens(provider: string): number {
  return DEFAULT_OUTPUT_TOKENS[provider] ?? 16000;
}

// ============ Capability Detection ============

/**
 * Returns true for models that embed reasoning inside 
 blocks
 * (Qwen3, QwQ, DeepSeek-R1). These need special streaming parsing.
 */
export function isThinkTagModel(modelId: string): boolean {
  let id = modelId.toLowerCase();
  // Strip single-segment prefixes (ollama-, ollama/, litellm/)
  id = id.replace(/^(ollama[-/]|litellm\/)/, '');
  // For path-style IDs (fireworks, together, openrouter, etc.)
  const lastSlash = id.lastIndexOf('/');
  if (lastSlash !== -1) id = id.slice(lastSlash + 1);
  // Strip version/tag suffixes (e.g. ":8b", ":latest", "-instruct")
  id = id.replace(/:.*$/, '');
  return /^(qwen3|qwq|deepseek-r)/.test(id);
}

function isToolCapable(modelId: string): boolean {
  // Strip ollama- prefix so "ollama-qwen2.5" matches /^qwen/ patterns
  const id = modelId.toLowerCase().replace(/^ollama-/, '');
  return TOOL_CAPABLE_PATTERNS.some(pattern => pattern.test(id));
}

function isVisionCapable(modelId: string): boolean {
  // Strip ollama- prefix for consistent pattern matching
  const id = modelId.toLowerCase().replace(/^ollama-/, '');
  return VISION_CAPABLE_PATTERNS.some(pattern => pattern.test(id));
}

function isParallelToolCapable(modelId: string): boolean {
  const id = modelId.toLowerCase().replace(/^ollama-/, '');
  return PARALLEL_TOOL_CAPABLE_PATTERNS.some(pattern => pattern.test(id));
}

function isThinkingCapable(modelId: string): boolean {
  const id = modelId.toLowerCase().replace(/^ollama-/, '');
  return THINKING_CAPABLE_PATTERNS.some(pattern => pattern.test(id));
}

function getContextWindow(modelId: string): number | null {
  // Try exact match first
  if (CONTEXT_WINDOWS[modelId]) {
    return CONTEXT_WINDOWS[modelId];
  }

  // Try prefix match (sort by key length descending for most specific match)
  const sortedEntries = Object.entries(CONTEXT_WINDOWS)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [key, value] of sortedEntries) {
    if (modelId.startsWith(key)) {
      return value;
    }
  }

  return null;
}

// ============ Model Filtering ============

// Models to exclude (embedding, audio, image generation, moderation, legacy)
const EXCLUDED_PATTERNS = [
  // Embedding models
  /embed/i,
  /text-embedding/i,
  // Audio models
  /whisper/i,
  /tts/i,
  /audio/i,
  /realtime/i,
  // Image generation
  /dall-e/i,
  /image/i,
  // Moderation & safety
  /text-moderation/i,
  /moderation/i,
  /omni-moderation/i,
  // Legacy/completion models (not chat)
  /babbage/i,
  /davinci/i,
  /curie/i,
  /ada(?!-)/i,  // ada but not ada-embedding
  /instruct(?!.*(gpt|turbo))/i,  // instruct models except gpt-instruct variants
  // Internal/preview/deprecated
  /canary/i,
  /deprecated/i,
  /preview.*audio/i,
  // Search/retrieval models
  /search/i,
  /similarity/i,
  // Code-specific non-chat models
  /code-davinci/i,
  /code-cushman/i,
  // Transcription
  /transcribe/i,
];

function isChatModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return !EXCLUDED_PATTERNS.some(pattern => pattern.test(id));
}

// ============ Provider Discovery ============

/**
 * Curated Ollama local models
 * Returns the approved models for local Ollama
 */
async function discoverOllamaModels(apiBase: string): Promise<DiscoveredModel[]> {
  // Validate connection by calling the tags endpoint
  const baseUrl = apiBase.replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/api/tags`);

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  // Curated list of approved Ollama models
  const OLLAMA_MODELS = [
    {
      id: 'gpt-oss:20b',
      name: 'GPT-OSS 20B',
      toolCapable: true,
      visionCapable: false,
      maxInputTokens: 131072,
      maxOutputTokens: 2000,
    },
    {
      id: 'qwen3.5:0.8b',
      name: 'Qwen3.5 0.8B',
      toolCapable: true,
      visionCapable: true,
      maxInputTokens: 131072,
      maxOutputTokens: 2000,
    },
    {
      id: 'qwen3.5:2b',
      name: 'Qwen3.5 2B',
      toolCapable: true,
      visionCapable: true,
      maxInputTokens: 131072,
      maxOutputTokens: 2000,
    },
    {
      id: 'ministral-3:3b',
      name: 'Ministral 3B',
      toolCapable: true,
      visionCapable: false,
      maxInputTokens: 131072,
      maxOutputTokens: 2000,
    },
    {
      id: 'llama3.2:3b',
      name: 'Llama3.2 3B',
      toolCapable: true,
      visionCapable: false,
      maxInputTokens: 131072,
      maxOutputTokens: 2000,
    },
  ];

  return Promise.all(
    OLLAMA_MODELS.map(async m => ({
      ...m,
      provider: 'ollama',
      isEnabled: !!(await getEnabledModel(m.id)),
    }))
  );
}

/**
 * Curated Fireworks AI models (Zero Data Retention, SOC2/GDPR/HIPAA)
 * Returns the 5 approved models rather than the full Fireworks catalog (300+)
 */
async function discoverFireworksModels(apiKey: string): Promise<DiscoveredModel[]> {
  // Validate API key by calling the models endpoint
  const response = await fetch('https://api.fireworks.ai/inference/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Fireworks API error: ${response.status} ${response.statusText}`);
  }

  const FIREWORKS_MODELS = [
    {
      id: 'fireworks/kimi-k2p6',
      name: 'Kimi K2.6',
      toolCapable: true,
      visionCapable: false,
      maxInputTokens: 131072,
      maxOutputTokens: 16384,
    },
    {
      id: 'fireworks/minimax-m2p7',
      name: 'MiniMax M2.7',
      toolCapable: true,
      visionCapable: false,
      maxInputTokens: 131072,
      maxOutputTokens: 16384,
    },
    {
      id: 'fireworks/qwen3p6-plus',
      name: 'Qwen3 P6 Plus',
      toolCapable: true,
      visionCapable: true,
      maxInputTokens: 131072,
      maxOutputTokens: 16384,
    },
    {
      id: 'fireworks/glm-5p1',
      name: 'GLM 5.1',
      toolCapable: true,
      visionCapable: false,
      maxInputTokens: 131072,
      maxOutputTokens: 16384,
    },
    {
      id: 'fireworks/gpt-oss-120b',
      name: 'OpenAI GPT-OSS 120B',
      toolCapable: true,
      visionCapable: false,
      maxInputTokens: 131072,
      maxOutputTokens: 16384,
    },
  ];

  return Promise.all(
    FIREWORKS_MODELS.map(async m => ({
      ...m,
      provider: 'fireworks',
      isEnabled: !!(await getEnabledModel(m.id)),
    }))
  );
}

// ============ Main Discovery Function ============

/**
 * Discover available models from a provider
 */
export async function discoverModels(provider: string): Promise<DiscoveryResult> {
  try {
    let models: DiscoveredModel[];

    switch (provider) {
      case 'ollama': {
        const apiBase = await getProviderApiBase('ollama');
        if (!apiBase) {
          return { success: false, provider, models: [], error: 'API base URL not configured' };
        }
        models = await discoverOllamaModels(apiBase);
        break;
      }

      case 'fireworks': {
        const apiKey = await getProviderApiKey('fireworks');
        if (!apiKey) {
          return { success: false, provider, models: [], error: 'API key not configured' };
        }
        models = await discoverFireworksModels(apiKey);
        break;
      }

      default:
        return { success: false, provider, models: [], error: `Unknown provider: ${provider}` };
    }

    return { success: true, provider, models };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Model Discovery] Error discovering ${provider} models:`, message);
    return { success: false, provider, models: [], error: message };
  }
}

/**
 * Test provider connection by attempting to list models
 */
export async function testProviderConnection(provider: string): Promise<{
  success: boolean;
  message: string;
  modelCount?: number;
}> {
  const result = await discoverModels(provider);

  if (result.success) {
    return {
      success: true,
      message: `Connected successfully. Found ${result.models.length} models.`,
      modelCount: result.models.length,
    };
  }

  return {
    success: false,
    message: result.error || 'Connection failed',
  };
}

/**
 * Discover models from all configured providers
 */
export async function discoverAllModels(): Promise<{
  providers: Record<string, DiscoveryResult>;
  totalModels: number;
}> {
  const providers = ['ollama', 'fireworks'];
  const results: Record<string, DiscoveryResult> = {};
  let totalModels = 0;

  const discoveries = await Promise.allSettled(
    providers.map(async (provider) => {
      const result = await discoverModels(provider);
      return { provider, result };
    })
  );

  for (const discovery of discoveries) {
    if (discovery.status === 'fulfilled') {
      const { provider, result } = discovery.value;
      results[provider] = result;
      if (result.success) {
        totalModels += result.models.length;
      }
    }
  }

  return { providers: results, totalModels };
}

// ============ Exported Capability Functions ============
// Used by enabled-models.ts to refresh model capabilities

export { isToolCapable, isVisionCapable, isParallelToolCapable, isThinkingCapable, getContextWindow };