'use client';

import { useState, useEffect } from 'react';
import { Bot, AlertCircle, CheckCircle, RefreshCw, Power, PowerOff, Key, Route } from 'lucide-react';
import Button from '@/components/ui/Button';

interface FireworksModel {
  id: string;
  name: string;
  toolCapable: boolean;
  visionCapable: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
  isEnabled: boolean;
}

interface RoutesSettings {
  route1Enabled: boolean;
  route2Enabled: boolean;
  route3Enabled: boolean;
  primaryRoute: 'route1' | 'route2' | 'route3';
}

export default function FireworksModelsTab() {
  const [models, setModels] = useState<FireworksModel[]>([]);
  const [routesSettings, setRoutesSettings] = useState<RoutesSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load Fireworks models
      const modelsRes = await fetch('/api/models?provider=fireworks');
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModels(data.models || []);
      }

      // Load routes settings
      const routesRes = await fetch('/api/admin/routes');
      if (routesRes.ok) {
        const data = await routesRes.json();
        setRoutesSettings(data.settings);
      }

      // Check if API key is configured
      const providersRes = await fetch('/api/admin/llm/providers');
      if (providersRes.ok) {
        const data = await providersRes.json();
        const fireworksProvider = data.providers?.find((p: { id: string; apiKeyConfigured?: boolean }) => p.id === 'fireworks');
        setApiKeyConfigured(fireworksProvider?.apiKeyConfigured || false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleModel = async (modelId: string, enable: boolean) => {
    setSaving(modelId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/models/enabled', {
        method: enable ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${enable ? 'enable' : 'disable'} model`);
      }

      setModels(models.map(m => 
        m.id === modelId ? { ...m, isEnabled: enable } : m
      ));
      setSuccess(`${modelId} ${enable ? 'enabled' : 'disabled'}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    } finally {
      setSaving(null);
    }
  };

  const enableRoute2 = async () => {
    if (!routesSettings) return;
    
    setSaving('route2');
    setError(null);

    try {
      const response = await fetch('/api/admin/routes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...routesSettings,
          route2Enabled: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to enable Route 2');
      }

      setRoutesSettings({ ...routesSettings, route2Enabled: true });
      setSuccess('Route 2 (Fireworks) enabled successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable Route 2');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Fireworks AI Models</h2>
          <p className="text-sm text-gray-500">Manage Fireworks AI models for Route 2</p>
        </div>
        <Button
          variant="secondary"
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* API Key Status */}
        <div className={`border rounded-lg p-4 ${apiKeyConfigured ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-3">
            <Key className={apiKeyConfigured ? 'text-green-600' : 'text-yellow-600'} size={20} />
            <div>
              <p className="font-medium text-gray-900">API Key</p>
              <p className={`text-sm ${apiKeyConfigured ? 'text-green-700' : 'text-yellow-700'}`}>
                {apiKeyConfigured ? 'Configured' : 'Not configured'}
              </p>
            </div>
          </div>
        </div>

        {/* Route 2 Status */}
        <div className={`border rounded-lg p-4 ${routesSettings?.route2Enabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Route className={routesSettings?.route2Enabled ? 'text-green-600' : 'text-red-600'} size={20} />
              <div>
                <p className="font-medium text-gray-900">Route 2 Status</p>
                <p className={`text-sm ${routesSettings?.route2Enabled ? 'text-green-700' : 'text-red-700'}`}>
                  {routesSettings?.route2Enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            {!routesSettings?.route2Enabled && (
              <Button
                size="sm"
                onClick={enableRoute2}
                loading={saving === 'route2'}
                className="bg-green-600 hover:bg-green-700"
              >
                Enable Route 2
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {!apiKeyConfigured && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-yellow-800">API Key Required</p>
            <p className="text-sm text-yellow-700">
              Configure your Fireworks AI API key in <strong>Settings → API Keys</strong> to use these models.
            </p>
          </div>
        </div>
      )}

      {!routesSettings?.route2Enabled && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-red-800">Route 2 Disabled</p>
            <p className="text-sm text-red-700">
              Route 2 must be enabled for Fireworks models to be used. Enable it above or in <strong>Settings → Routes</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="text-green-600" size={20} />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Models List */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-medium text-gray-900">Available Models</h3>
          <p className="text-sm text-gray-500">
            Curated Fireworks AI models with Zero Data Retention, SOC2/GDPR/HIPAA compliance
          </p>
        </div>
        
        {models.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bot size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No Fireworks models found</p>
          </div>
        ) : (
          <div className="divide-y">
            {models.map(model => (
              <div key={model.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{model.name}</p>
                    {model.toolCapable && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Tools</span>
                    )}
                    {model.visionCapable && (
                      <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Vision</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-mono">{model.id}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Context: {(model.maxInputTokens / 1000).toFixed(0)}K tokens • Output: {(model.maxOutputTokens / 1000).toFixed(0)}K tokens
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${model.isEnabled ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                    {model.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Button
                    size="sm"
                    variant={model.isEnabled ? 'secondary' : 'primary'}
                    onClick={() => toggleModel(model.id, !model.isEnabled)}
                    loading={saving === model.id}
                    className={model.isEnabled ? 'text-red-600 hover:bg-red-50' : 'bg-green-600 hover:bg-green-700'}
                  >
                    {model.isEnabled ? (
                      <><PowerOff size={14} className="mr-1" /> Disable</>
                    ) : (
                      <><Power size={14} className="mr-1" /> Enable</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">About Fireworks AI</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Direct API integration (bypasses LiteLLM proxy)</li>
          <li>• Zero Data Retention - your data is not stored or used for training</li>
          <li>• SOC2, GDPR, and HIPAA compliant</li>
          <li>• Models support tool calling and parallel execution</li>
        </ul>
      </div>
    </div>
  );
}