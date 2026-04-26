'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw, 
  Settings2,
  Key,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface RerankerProviderConfig {
  provider: string;
  enabled: boolean;
  name: string;
  description: string;
  requiresApiKey?: boolean;
  isLocal?: boolean;
}

interface RerankerSettings {
  enabled: boolean;
  providers: RerankerProviderConfig[];
  cohereApiKey?: string;
  topKForReranking: number;
  minRerankerScore: number;
  cacheTTLSeconds: number;
  updatedAt?: string;
  updatedBy?: string;
  hasCohereApiKey?: boolean;
  cohereApiKeyFromEnv?: boolean;
}

interface ProviderStatus {
  provider: string;
  status: 'available' | 'unavailable' | 'checking' | 'error';
  latency?: number;
  error?: string;
}

const PROVIDER_INFO: Record<string, { name: string; description: string; requiresApiKey: boolean; isLocal: boolean }> = {
  'ollama': {
    name: 'Ollama (Local)',
    description: 'Uses local Ollama instance with bbjson/bge-reranker-base model. Requires Ollama server running.',
    requiresApiKey: false,
    isLocal: true,
  },
  'bge-large': {
    name: 'BGE Reranker Large',
    description: 'Cross-encoder model (335M params, ~670MB). Best accuracy, runs locally via transformers.js.',
    requiresApiKey: false,
    isLocal: true,
  },
  'bge-base': {
    name: 'BGE Reranker Base',
    description: 'Cross-encoder model (110M params, ~220MB). Good accuracy with smaller footprint.',
    requiresApiKey: false,
    isLocal: true,
  },
  'local': {
    name: 'Local Bi-encoder (Legacy)',
    description: 'Uses all-MiniLM-L6-v2 for cosine similarity. Less accurate but fastest.',
    requiresApiKey: false,
    isLocal: true,
  },
  'cohere': {
    name: 'Cohere API',
    description: 'Cloud-based reranking via Cohere API. Fast and accurate, requires API key.',
    requiresApiKey: true,
    isLocal: false,
  },
  'fireworks': {
    name: 'Fireworks AI',
    description: 'Cloud-based Qwen3 reranker via Fireworks AI. Requires API key.',
    requiresApiKey: true,
    isLocal: false,
  },
};

export default function RerankerSettings() {
  const [settings, setSettings] = useState<RerankerSettings | null>(null);
  const [editedSettings, setEditedSettings] = useState<RerankerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modified, setModified] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      
      const data = await response.json();
      if (data.reranker) {
        // Enrich provider configs with display info
        const enrichedProviders = data.reranker.providers.map((p: RerankerProviderConfig) => ({
          ...p,
          ...PROVIDER_INFO[p.provider],
        }));
        
        const settingsWithInfo = {
          ...data.reranker,
          providers: enrichedProviders,
        };
        
        setSettings(settingsWithInfo);
        setEditedSettings(JSON.parse(JSON.stringify(settingsWithInfo)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Check if settings have been modified
  useEffect(() => {
    if (settings && editedSettings) {
      setModified(JSON.stringify(settings) !== JSON.stringify(editedSettings));
    }
  }, [settings, editedSettings]);

  // Test a specific provider
  const testProvider = async (provider: string) => {
    setTesting(prev => ({ ...prev, [provider]: true }));
    setProviderStatuses(prev => ({ ...prev, [provider]: { provider, status: 'checking' } }));
    
    try {
      const response = await fetch('/api/admin/settings/reranker/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      
      const result = await response.json();
      
      setProviderStatuses(prev => ({
        ...prev,
        [provider]: {
          provider,
          status: result.available ? 'available' : 'unavailable',
          latency: result.latency,
          error: result.error,
        },
      }));
    } catch (err) {
      setProviderStatuses(prev => ({
        ...prev,
        [provider]: {
          provider,
          status: 'error',
          error: err instanceof Error ? err.message : 'Test failed',
        },
      }));
    } finally {
      setTesting(prev => ({ ...prev, [provider]: false }));
    }
  };

  // Test all providers
  const testAllProviders = async () => {
    if (!editedSettings) return;
    
    for (const provider of editedSettings.providers) {
      await testProvider(provider.provider);
    }
  };

  // Move provider up in priority
  const moveProviderUp = (index: number) => {
    if (!editedSettings || index === 0) return;
    
    const newProviders = [...editedSettings.providers];
    [newProviders[index - 1], newProviders[index]] = [newProviders[index], newProviders[index - 1]];
    
    setEditedSettings({
      ...editedSettings,
      providers: newProviders,
    });
  };

  // Move provider down in priority
  const moveProviderDown = (index: number) => {
    if (!editedSettings || index === editedSettings.providers.length - 1) return;
    
    const newProviders = [...editedSettings.providers];
    [newProviders[index], newProviders[index + 1]] = [newProviders[index + 1], newProviders[index]];
    
    setEditedSettings({
      ...editedSettings,
      providers: newProviders,
    });
  };

  // Toggle provider enabled state
  const toggleProvider = (index: number) => {
    if (!editedSettings) return;
    
    const newProviders = [...editedSettings.providers];
    newProviders[index] = {
      ...newProviders[index],
      enabled: !newProviders[index].enabled,
    };
    
    setEditedSettings({
      ...editedSettings,
      providers: newProviders,
    });
  };

  // Save settings
  const handleSave = async () => {
    if (!editedSettings) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Strip display info before sending
      const providersToSave = editedSettings.providers.map(p => ({
        provider: p.provider,
        enabled: p.enabled,
      }));
      
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reranker',
          settings: {
            enabled: editedSettings.enabled,
            providers: providersToSave,
            cohereApiKey: editedSettings.cohereApiKey,
            topKForReranking: editedSettings.topKForReranking,
            minRerankerScore: editedSettings.minRerankerScore,
            cacheTTLSeconds: editedSettings.cacheTTLSeconds,
          },
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      
      const data = await response.json();
      
      // Update local state with response
      const enrichedProviders = data.reranker.providers.map((p: RerankerProviderConfig) => ({
        ...p,
        ...PROVIDER_INFO[p.provider],
      }));
      
      const settingsWithInfo = {
        ...data.reranker,
        providers: enrichedProviders,
      };
      
      setSettings(settingsWithInfo);
      setEditedSettings(JSON.parse(JSON.stringify(settingsWithInfo)));
      setSuccess('Reranker settings saved successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Reset to saved settings
  const handleReset = () => {
    if (settings) {
      setEditedSettings(JSON.parse(JSON.stringify(settings)));
      setError(null);
      setSuccess(null);
    }
  };

  // Get status icon for provider
  const getStatusIcon = (provider: string) => {
    const status = providerStatuses[provider]?.status;
    
    switch (status) {
      case 'available':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'unavailable':
      case 'error':
        return <X className="w-5 h-5 text-red-500" />;
      case 'checking':
        return <Spinner size="sm" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!editedSettings) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load reranker settings</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Reranker Settings
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure document reranking providers and their priority order
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={testAllProviders}
            disabled={testing['all']}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${Object.values(testing).some(Boolean) ? 'animate-spin' : ''}`} />
            Test All
          </Button>
          <Button
            variant="secondary"
            onClick={handleReset}
            disabled={!modified || saving}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!modified || saving}
          >
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <Check className="w-5 h-5" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Main Toggle */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Enable Reranking</h3>
            <p className="text-sm text-gray-500 mt-1">
              When enabled, retrieved documents are reranked for better relevance. 
              When disabled, documents use original similarity scores.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={editedSettings.enabled}
              onChange={(e) => setEditedSettings({ ...editedSettings, enabled: e.target.checked })}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Provider Priority List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Provider Priority Order
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Providers are tried in order. If one fails, the next is attempted.
            Drag or use arrows to reorder.
          </p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {editedSettings.providers.map((provider, index) => (
            <div 
              key={provider.provider}
              className={`p-4 flex items-center gap-4 ${!provider.enabled ? 'opacity-60' : ''}`}
            >
              {/* Priority Number */}
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                {index + 1}
              </div>
              
              {/* Provider Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{provider.name}</span>
                  {provider.isLocal && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      Local
                    </span>
                  )}
                  {provider.requiresApiKey && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      API Key
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{provider.description}</p>
              </div>
              
              {/* Status */}
              <div className="flex items-center gap-2">
                {getStatusIcon(provider.provider)}
                {providerStatuses[provider.provider]?.status === 'unavailable' && (
                  <span className="text-xs text-red-600">
                    {providerStatuses[provider.provider]?.error || 'Unavailable'}
                  </span>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testProvider(provider.provider)}
                  disabled={testing[provider.provider]}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Test provider"
                >
                  {testing[provider.provider] ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={() => moveProviderUp(index)}
                  disabled={index === 0}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => moveProviderDown(index)}
                  disabled={index === editedSettings.providers.length - 1}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                
                <label className="relative inline-flex items-center cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={provider.enabled}
                    onChange={() => toggleProvider(index)}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Advanced Settings
          </h3>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Cohere API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Cohere API Key
              {editedSettings.hasCohereApiKey && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  {editedSettings.cohereApiKeyFromEnv ? 'From Env' : 'Configured'}
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={editedSettings.cohereApiKey || ''}
                onChange={(e) => setEditedSettings({ ...editedSettings, cohereApiKey: e.target.value })}
                placeholder={editedSettings.hasCohereApiKey ? '••••••••' : 'Enter API key'}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Required for Cohere reranker. Falls back to COHERE_API_KEY environment variable if not set.
            </p>
          </div>

          {/* Top K for Reranking */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Top K Chunks to Rerank
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={editedSettings.topKForReranking}
              onChange={(e) => setEditedSettings({ 
                ...editedSettings, 
                topKForReranking: parseInt(e.target.value) || 50 
              })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of chunks to rerank (5-100). Higher values use more compute.
            </p>
          </div>

          {/* Min Reranker Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Reranker Score
            </label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={editedSettings.minRerankerScore}
              onChange={(e) => setEditedSettings({ 
                ...editedSettings, 
                minRerankerScore: parseFloat(e.target.value) || 0.3 
              })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Threshold for filtering reranked chunks (0-1). Lower values include more results.
            </p>
          </div>

          {/* Cache TTL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cache TTL (seconds)
            </label>
            <input
              type="number"
              min={0}
              max={86400}
              value={editedSettings.cacheTTLSeconds}
              onChange={(e) => setEditedSettings({ 
                ...editedSettings, 
                cacheTTLSeconds: parseInt(e.target.value) || 3600 
              })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              How long to cache reranker results (0-86400). 0 disables caching.
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How Reranking Works</p>
            <p className="text-blue-700">
              When a user asks a question, the system first retrieves relevant document chunks using 
              vector similarity search. Then, the reranker re-evaluates these chunks against the 
              query to provide more accurate relevance scores. The providers above are tried in 
              order until one succeeds.
            </p>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {settings?.updatedAt && (
        <div className="text-xs text-gray-500 text-right">
          Last updated: {new Date(settings.updatedAt).toLocaleString()} 
          {settings.updatedBy && ` by ${settings.updatedBy}`}
        </div>
      )}
    </div>
  );
}