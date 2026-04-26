'use client';

import { useState, useEffect } from 'react';
import { Brain, AlertCircle, CheckCircle, Info, RefreshCw, Cloud, CloudOff, Key, Search, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';

interface LLMSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  promptOptimizationMaxTokens: number;
  updatedAt?: string;
  updatedBy?: string;
}

interface AvailableModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  defaultMaxTokens: number;
}

interface CloudModel {
  id: string;
  displayName: string;
  providerId: string;
  toolCapable: boolean;
  visionCapable: boolean;
  isCloud: boolean;
  enabled: boolean;
  size?: number;
}

interface DiscoveredModel {
  id: string;
  name: string;
  tag: string;
  size: number;
  is_cloud: boolean;
  toolCapable: boolean;
  visionCapable: boolean;
}

export default function LLMSettingsTab() {
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<LLMSettings | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [modified, setModified] = useState(false);

  // Ollama Cloud state
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [cloudModels, setCloudModels] = useState<CloudModel[]>([]);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudDiscovering, setCloudDiscovering] = useState(false);
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  
  // Filter state
  const [filterVision, setFilterVision] = useState(false);
  const [filterTools, setFilterTools] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSettings();
    loadCloudStatus();
  }, []);

  const loadCloudStatus = async () => {
    setCloudLoading(true);
    try {
      const response = await fetch('/api/ollama/cloud?action=status');
      if (response.ok) {
        const data = await response.json();
        setCloudConfigured(data.configured);
        setCloudModels(data.enabledModels || []);
      }
    } catch (err) {
      console.error('Failed to load cloud status:', err);
    } finally {
      setCloudLoading(false);
    }
  };

  const discoverCloudModels = async () => {
    setCloudDiscovering(true);
    setError(null);
    try {
      const response = await fetch('/api/ollama/cloud?action=discover');
      const data = await response.json();
      if (data.success) {
        // Sync discovered models to database
        const syncResponse = await fetch('/api/ollama/cloud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync', models: data.models }),
        });
        const syncData = await syncResponse.json();
        
        // Store discovered models with capabilities
        const modelsWithCapabilities: DiscoveredModel[] = data.models.map((m: { id: string; name: string; tag: string; size: number; is_cloud: boolean }) => {
          const capabilities = detectCapabilities(m.id);
          return {
            ...m,
            toolCapable: capabilities.toolCapable,
            visionCapable: capabilities.visionCapable,
          };
        });
        setDiscoveredModels(modelsWithCapabilities);
        
        // Reload status to get updated enabled models
        await loadCloudStatus();
        
        if (syncData.addedCount > 0) {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        }
        
        // Show info that models are auto-enabled
        if (data.models.length > 0) {
          console.log(`[Ollama Cloud] Discovered ${data.models.length} models, ${syncData.addedCount} new models auto-enabled`);
        }
      } else {
        setError(data.error || 'Failed to discover cloud models');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover cloud models');
    } finally {
      setCloudDiscovering(false);
    }
  };

  // Helper to detect capabilities from model name (mirrors backend logic)
  const detectCapabilities = (modelId: string): { toolCapable: boolean; visionCapable: boolean } => {
    const name = modelId.toLowerCase();
    const visionPatterns = ['vl', 'vision', 'multimodal', 'qvq'];
    const toolPatterns = ['coder', 'code', 'instruct', 'chat'];
    
    const visionCapable = visionPatterns.some(p => name.includes(p));
    const toolCapable = toolPatterns.some(p => name.includes(p)) || !visionCapable;
    
    return { toolCapable, visionCapable };
  };

  // Format model size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return 'Unknown';
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Filter models
  const filteredModels = discoveredModels.filter(model => {
    // Search filter
    if (searchQuery && !model.id.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !model.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Vision filter
    if (filterVision && !model.visionCapable) {
      return false;
    }
    // Tools filter
    if (filterTools && !model.toolCapable) {
      return false;
    }
    return true;
  });

  // Check if a model is enabled
  const isModelEnabled = (modelId: string): boolean => {
    return cloudModels.some(m => m.id === modelId && m.enabled);
  };

  const toggleCloudModel = async (modelId: string, currentlyEnabled: boolean) => {
    try {
      const response = await fetch('/api/ollama/cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: currentlyEnabled ? 'disable' : 'enable',
          modelId,
        }),
      });
      if (response.ok) {
        await loadCloudStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle cloud model');
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      
      if (data.llm) {
        setSettings(data.llm);
        setOriginalSettings(data.llm);
      }
      if (data.availableModels) {
        setAvailableModels(data.availableModels);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof LLMSettings, value: string | number) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    setModified(JSON.stringify(newSettings) !== JSON.stringify(originalSettings));
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'llm',
          settings: {
            model: settings.model,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            promptOptimizationMaxTokens: settings.promptOptimizationMaxTokens,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setOriginalSettings(settings);
      setModified(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (!originalSettings) return;
    setSettings(originalSettings);
    setModified(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="text-red-600" size={20} />
        <p className="text-red-700">Failed to load LLM settings</p>
      </div>
    );
  }

  // Group models by provider
  const modelsByProvider = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, AvailableModel[]>);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="text-blue-600 mt-0.5" size={20} />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">LLM Configuration</p>
          <p>Configure the default language model settings. These settings apply to all chat conversations unless overridden per-thread.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="text-green-600" size={20} />
          <p className="text-green-700">LLM settings saved successfully!</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 space-y-6">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Model
          </label>
          <select
            value={settings.model}
            onChange={(e) => handleChange('model', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a model...</option>
            {Object.entries(modelsByProvider).map(([provider, models]) => (
              <optgroup key={provider} label={provider.toUpperCase()}>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Currently selected: <span className="font-medium">{settings.model}</span>
          </p>
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Temperature: {settings.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.temperature}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Precise (0)</span>
            <span>Balanced (1)</span>
            <span>Creative (2)</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Tokens
          </label>
          <input
            type="number"
            min="100"
            max="32000"
            step="100"
            value={settings.maxTokens}
            onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum number of tokens to generate in responses
          </p>
        </div>

        {/* Prompt Optimization Max Tokens */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prompt Optimization Max Tokens
          </label>
          <input
            type="number"
            min="100"
            max="8000"
            step="100"
            value={settings.promptOptimizationMaxTokens}
            onChange={(e) => handleChange('promptOptimizationMaxTokens', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Max tokens for internal prompt optimization calls
          </p>
        </div>
      </div>

      {/* Last Updated */}
      {settings.updatedAt && (
        <div className="text-sm text-gray-500">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
          {settings.updatedBy && ` by ${settings.updatedBy}`}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={resetToDefaults}
          disabled={!modified || saving}
          className="flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Reset Changes
        </Button>
        <Button
          onClick={saveSettings}
          loading={saving}
          disabled={!modified}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Save LLM Settings
        </Button>
      </div>

      {/* Ollama Cloud Section */}
      <div className="border-t pt-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          {cloudConfigured ? (
            <Cloud className="text-blue-600" size={20} />
          ) : (
            <CloudOff className="text-gray-400" size={20} />
          )}
          <h3 className="text-lg font-medium">Ollama Cloud</h3>
          {cloudLoading && <Loader2 className="animate-spin text-gray-400" size={16} />}
        </div>

        <div className="bg-gray-50 border rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Info className="text-gray-500 mt-0.5" size={18} />
            <div className="text-sm text-gray-600">
              <p className="mb-1">
                Ollama Cloud allows running large models (70B+ parameters) without local GPU resources.
              </p>
              <p>
                Set <code className="bg-gray-200 px-1 rounded">OLLAMA_API_KEY</code> in your environment to enable cloud models.
              </p>
            </div>
          </div>
        </div>

        {cloudConfigured ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle size={18} />
              <span className="text-sm font-medium">API Key Configured</span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={discoverCloudModels}
                disabled={cloudDiscovering}
                className="flex items-center gap-2"
              >
                {cloudDiscovering ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Search size={16} />
                )}
                Discover Cloud Models
              </Button>
            </div>

            {/* Discovered Models Section */}
            {discoveredModels.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">
                    Discovered Models ({filteredModels.length} of {discoveredModels.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search models..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 pr-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                      />
                    </div>
                    {/* Filter buttons */}
                    <button
                      onClick={() => setFilterVision(!filterVision)}
                      className={`px-2 py-1 text-xs rounded border ${
                        filterVision 
                          ? 'bg-purple-100 border-purple-300 text-purple-700' 
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Vision
                    </button>
                    <button
                      onClick={() => setFilterTools(!filterTools)}
                      className={`px-2 py-1 text-xs rounded border ${
                        filterTools 
                          ? 'bg-blue-100 border-blue-300 text-blue-700' 
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Tools
                    </button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capabilities</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Enabled</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredModels.map((model) => {
                        const enabled = isModelEnabled(model.id);
                        return (
                          <tr key={model.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{model.name}</div>
                              <div className="text-xs text-gray-500">{model.id}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-600">{formatSize(model.size)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                {model.toolCapable && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Tools
                                  </span>
                                )}
                                {model.visionCapable && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    Vision
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleCloudModel(model.id, enabled)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {enabled ? (
                                  <ToggleRight className="text-green-600" size={24} />
                                ) : (
                                  <ToggleLeft className="text-gray-400" size={24} />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Enabled Models Summary */}
            {cloudModels.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <h4 className="text-sm font-medium text-gray-700">
                    Enabled Models ({cloudModels.filter(m => m.enabled).length})
                  </h4>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {cloudModels.filter(m => m.enabled).map((model) => (
                      <div key={model.id} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-1">
                        <span className="text-sm text-green-800">{model.displayName}</span>
                        <button
                          onClick={() => toggleCloudModel(model.id, true)}
                          className="text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {cloudModels.filter(m => m.enabled).length === 0 && (
                      <span className="text-sm text-gray-500">No models enabled</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-700">
              <Key size={18} />
              <span className="text-sm font-medium">API Key Required</span>
            </div>
            <p className="text-sm text-yellow-600 mt-2">
              Add <code className="bg-yellow-100 px-1 rounded">OLLAMA_API_KEY</code> to your environment variables to enable Ollama Cloud.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
