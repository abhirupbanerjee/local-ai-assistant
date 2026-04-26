/*
 * Internal LLM Client
 *
 * Shared utility for internal services (memory extraction, summarization,
 * prompt optimization, translation) with multi-route fallback.
 *
 * Route 2: Fireworks AI direct
 * Route 3: Ollama direct (local / air-gapped)
 * Route 4: Ollama Cloud (cloud-hosted models via ollama.com)
 */

import OpenAI from 'openai';
import { getLlmSettings, getRoutesSettings } from './db/compat/config';
import { getEnabledModel } from './db/compat/enabled-models';
import { getApiKey, getApiBase } from '@/lib/provider-helpers';
import { getOllamaCloudApiKey } from './services/ollama-cloud';

const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1';
const OLLAMA_CLOUD_BASE_URL = 'https://ollama.com/api';
const FIREWORKS_FALLBACK_MODEL = 'accounts/fireworks/models/minimax-m2p5';

// ============ Types ============

export interface InternalCompletionOptions {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ============ Clients (lazy singletons) ============

let fireworksClient: OpenAI | null = null;
let ollamaClient: OpenAI | null = null;
let ollamaCloudClient: OpenAI | null = null;

async function getFireworksClient(): Promise<OpenAI> {
  if (!fireworksClient) {
    const apiKey = await getApiKey('fireworks');
    fireworksClient = new OpenAI({
      apiKey: apiKey || undefined,
      baseURL: FIREWORKS_BASE_URL,
    });
  }
  return fireworksClient;
}

async function getOllamaClient(): Promise<OpenAI> {
  if (!ollamaClient) {
    const apiBase = await getApiBase('ollama');
    const baseURL = ((apiBase || 'http://localhost:11434').replace(/\/v1\/?$/, '')) + '/v1';
    ollamaClient = new OpenAI({
      apiKey: 'ollama',
      baseURL,
    });
  }
  return ollamaClient;
}

async function getOllamaCloudClient(): Promise<OpenAI> {
  if (!ollamaCloudClient) {
    const apiKey = await getOllamaCloudApiKey();
    ollamaCloudClient = new OpenAI({
      apiKey: apiKey || undefined,
      baseURL: OLLAMA_CLOUD_BASE_URL,
    });
  }
  return ollamaCloudClient;
}

// ============ Provider Callers ============

async function callFireworks(model: string, opts: InternalCompletionOptions): Promise<string> {
  const client = await getFireworksClient();
  const response = await client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2000,
  });
  return response.choices[0]?.message?.content?.trim() || '';
}

async function callOllama(model: string, opts: InternalCompletionOptions): Promise<string> {
  const client = await getOllamaClient();
  // Strip ollama- or ollama/ prefix for the API call
  const ollamaModel = model.startsWith('ollama/') ? model.slice('ollama/'.length)
    : model.startsWith('ollama-') ? model.slice('ollama-'.length)
    : model;
  const response = await client.chat.completions.create({
    model: ollamaModel,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2000,
  });
  return response.choices[0]?.message?.content?.trim() || '';
}

async function callOllamaCloud(model: string, opts: InternalCompletionOptions): Promise<string> {
  const apiKey = await getOllamaCloudApiKey();
  if (!apiKey) {
    throw new Error('Ollama Cloud API key not configured');
  }
  
  // Strip ollama-cloud/ prefix if present
  const cloudModel = model.startsWith('ollama-cloud/') ? model.slice('ollama-cloud/'.length) : model;
  
  // Use native Ollama API format
  const response = await fetch(`${OLLAMA_CLOUD_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cloudModel,
      messages: opts.messages,
      stream: false,
      options: {
        num_predict: opts.maxTokens ?? 2000,
        temperature: opts.temperature ?? 0.3,
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error('Invalid Ollama Cloud API key');
    }
    throw new Error(`Ollama Cloud error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json() as { message?: { content?: string } };
  return data.message?.content?.trim() || '';
}

// ============ Route Classification ============

function isFireworksModel(model: string): boolean {
  return model.startsWith('fireworks/');
}

function isOllamaModel(model: string): boolean {
  return model.startsWith('ollama-') || model.startsWith('ollama/');
}

async function isOllamaModelForRouting(model: string): Promise<boolean> {
  if (isOllamaModel(model)) return true;

  try {
    const dbModel = await getEnabledModel(model);
    return dbModel?.providerId === 'ollama';
  } catch {
    return false;
  }
}

function isOllamaCloudModel(model: string): boolean {
  return model.startsWith('ollama-cloud/') || model.endsWith('-cloud') || model.includes(':cloud');
}

/**
 * Check if a model is an Ollama Cloud model by checking the database
 * This is needed because models may be stored without the 'ollama-cloud/' prefix
 */
async function isOllamaCloudModelForRouting(model: string): Promise<boolean> {
  if (isOllamaCloudModel(model)) return true;

  try {
    const dbModel = await getEnabledModel(model);
    return dbModel?.providerId === 'ollama-cloud';
  } catch {
    return false;
  }
}

// ============ Main Entry Point ============

/**
 * Create a completion using the configured LLM route with automatic fallback.
 *
 * - Route 2 models (Fireworks) always go direct.
 * - Route 3 models (Ollama) always go direct.
 * - Route 4 models (Ollama Cloud) always go direct to ollama.com.
 * - Unknown models fall back to Route 2/3/4 based on settings.
 */
export async function createInternalCompletion(opts: InternalCompletionOptions): Promise<string> {
  const model = opts.model || (await getLlmSettings()).model;
  const routes = await getRoutesSettings();
  const useOllamaCloud = await isOllamaCloudModelForRouting(model);
  const useOllamaLocal = !useOllamaCloud && await isOllamaModelForRouting(model);

  // Route 2 models → always direct
  if (isFireworksModel(model)) {
    return callFireworks(model, opts);
  }

  // Route 3 models → always direct to Ollama (local)
  if (useOllamaLocal) {
    return callOllama(model, opts);
  }

  // Route 4 models → always direct to Ollama Cloud
  if (useOllamaCloud) {
    return callOllamaCloud(model, opts);
  }

  // Unknown model - try fallback routes
  const hasRoute2 = routes.route2Enabled;
  const hasRoute3 = routes.route3Enabled;

  if (!hasRoute2 && !hasRoute3) {
    throw new Error(`Unknown model "${model}" and no fallback routes enabled`);
  }

  console.warn(`[llm-client] Unknown model "${model}", trying fallback routes`);

  // Try Route 2 first (Fireworks), then Route 3 (Ollama)
  if (hasRoute2) {
    try {
      return await callFireworks(FIREWORKS_FALLBACK_MODEL, opts);
    } catch (fwErr) {
      console.warn('[llm-client] Fireworks fallback failed:', fwErr instanceof Error ? fwErr.message : fwErr);
    }
  }

  // Route 3 fallback (Ollama) — use default Ollama model
  if (hasRoute3) {
    console.warn('[llm-client] Trying Route 3 (Ollama) fallback');
    return await callOllama('ollama-llama3.2', opts);
  }

  throw new Error(`All fallback routes failed for model "${model}"`);
}
