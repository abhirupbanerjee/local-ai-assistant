'use client';

import { useState, useEffect } from 'react';
import { Database, AlertCircle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

interface EmbeddingSettings {
  model: string;
  dimensions: number;
  fallbackModel?: string;
  updatedAt?: string;
  updatedBy?: string;
}

interface AvailableEmbeddingModel {
  id: string;
  name: string;
  dimensions: number;
  provider: string;
  local: boolean;
  available: boolean;
}

export default function EmbeddingSettingsTab() {
  const [settings, setSettings] = useState<EmbeddingSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<EmbeddingSettings | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableEmbeddingModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      
      if (data.embedding) {
        setSettings(data.embedding);
        setOriginalSettings(data.embedding);
      }
      if (data.availableEmbeddingModels) {
        setAvailableModels(data.availableEmbeddingModels);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof EmbeddingSettings, value: string | number) => {
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
          type: 'embedding',
          settings: {
            model: settings.model,
            dimensions: settings.dimensions,
            fallbackModel: settings.fallbackModel,
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
        <p className="text-red-700">Failed to load embedding settings</p>
      </div>
    );
  }

  // Group models by provider
  const modelsByProvider = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, AvailableEmbeddingModel[]>);

  const selectedModel = availableModels.find(m => m.id === settings.model);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="text-blue-600 mt-0.5" size={20} />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">Embedding Configuration</p>
          <p>Configure the embedding model used for document vectorization and semantic search.</p>
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
          <p className="text-green-700">Embedding settings saved successfully!</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 space-y-6">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Embedding Model
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
                  <option key={model.id} value={model.id} disabled={!model.available}>
                    {model.name} ({model.dimensions}d) {model.local ? '[Local]' : ''} {!model.available ? '- Unavailable' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Currently selected: <span className="font-medium">{settings.model}</span>
          </p>
        </div>

        {/* Model Info */}
        {selectedModel && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-gray-900">Model Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2 font-medium">{selectedModel.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Dimensions:</span>
                <span className="ml-2 font-medium">{selectedModel.dimensions}</span>
              </div>
              <div>
                <span className="text-gray-500">Provider:</span>
                <span className="ml-2 font-medium capitalize">{selectedModel.provider}</span>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 font-medium">{selectedModel.local ? 'Local' : 'Cloud'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dimensions: {settings.dimensions}
          </label>
          <input
            type="range"
            min="256"
            max="3072"
            step="256"
            value={settings.dimensions}
            onChange={(e) => handleChange('dimensions', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Vector dimensions for embeddings (must match the selected model)
          </p>
        </div>

        {/* Fallback Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fallback Model (Optional)
          </label>
          <select
            value={settings.fallbackModel || ''}
            onChange={(e) => handleChange('fallbackModel', e.target.value || '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No fallback (use primary model)</option>
            {availableModels.filter(m => m.id !== settings.model).map((model) => (
              <option key={model.id} value={model.id} disabled={!model.available}>
                {model.name} ({model.dimensions}d) {!model.available ? '- Unavailable' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Fallback model used if primary model fails
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
          Save Embedding Settings
        </Button>
      </div>
    </div>
  );
}