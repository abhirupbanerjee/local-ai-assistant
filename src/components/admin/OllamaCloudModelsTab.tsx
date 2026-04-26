'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cloud, RefreshCw, CheckCircle, XCircle, AlertCircle, Loader2, Sparkles, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface OllamaCloudModel {
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

interface CloudModelConfig {
  id: string;
  displayName: string;
  providerId: string;
  toolCapable: boolean;
  visionCapable: boolean;
  enabled: boolean;
}

interface DiscoveryResult {
  success: boolean;
  models: OllamaCloudModel[];
  error?: string;
}

export default function OllamaCloudModelsTab() {
  const [configured, setConfigured] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<OllamaCloudModel[]>([]);
  const [dbModels, setDbModels] = useState<CloudModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingAll, setTogglingAll] = useState<'enable' | 'disable' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [routesSettings, setRoutesSettings] = useState<{ route3Enabled: boolean } | null>(null);
  const [enablingRoute3, setEnablingRoute3] = useState(false);
  
  // Local state for pending changes (not yet saved to DB)
  // Key: modelId, Value: enabled status (local override)
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check if ollama-cloud is configured
      const statusRes = await fetch('/api/ollama/cloud?action=status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setConfigured(statusData.configured);
      }

      // Get all models from database
      const modelsRes = await fetch('/api/ollama/cloud?action=models');
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        setDbModels(modelsData.models || []);
      }

      // Check routes settings
      const routesRes = await fetch('/api/admin/routes');
      if (routesRes.ok) {
        const routesData = await routesRes.json();
        setRoutesSettings(routesData.settings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleDiscover = async () => {
    setDiscovering(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/ollama/cloud?action=discover');
      const data: DiscoveryResult = await res.json();
      
      if (data.success) {
        setDiscoveredModels(data.models);
        if (data.models.length === 0) {
          setError('No models found. Make sure your Ollama Cloud account has models available.');
        } else {
          setSuccessMessage(`Found ${data.models.length} cloud model(s)`);
        }
      } else {
        setError(data.error || 'Failed to discover models');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover models');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSyncModels = async () => {
    if (discoveredModels.length === 0) return;
    
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/ollama/cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          models: discoveredModels,
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || `Synced ${data.addedCount} models`);
        setDiscoveredModels([]);
        await loadStatus();
      } else {
        setError(data.error || 'Failed to sync models');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync models');
    } finally {
      setSyncing(false);
    }
  };

  // Toggle model enabled status locally (not saved until Save button clicked)
  const handleToggleModel = (modelId: string, currentlyEnabled: boolean) => {
    const newEnabled = !currentlyEnabled;
    
    // Check if this change matches the DB state (i.e., user is reverting a change)
    const dbModel = dbModels.find(m => m.id === modelId);
    if (dbModel && dbModel.enabled === newEnabled) {
      // Remove from pending changes (reverting to DB state)
      const newPending = new Map(pendingChanges);
      newPending.delete(modelId);
      setPendingChanges(newPending);
    } else {
      // Add to pending changes
      setPendingChanges(new Map(pendingChanges).set(modelId, newEnabled));
    }
  };

  // Save all pending changes to database
  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) return;
    
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const updates = Array.from(pendingChanges.entries()).map(([modelId, enabled]) => ({
        modelId,
        enabled,
      }));
      
      const res = await fetch('/api/ollama/cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch-update',
          updates,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(data.message || `Updated ${data.updatedCount} model(s)`);
        setPendingChanges(new Map()); // Clear pending changes
        await loadStatus();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const enableRoute3 = async () => {
    setEnablingRoute3(true);
    try {
      const response = await fetch('/api/admin/routes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route3Enabled: true }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoutesSettings(data.settings);
        setSuccessMessage('Route 3 (Ollama) enabled! Models will now appear in chat.');
      } else {
        setError('Failed to enable Route 3');
      }
    } catch (err) {
      setError('Failed to enable Route 3');
    } finally {
      setEnablingRoute3(false);
    }
  };

  const handleEnableAll = async () => {
    setTogglingAll('enable');
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/ollama/cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable-all' }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(data.message || 'All cloud models enabled');
        await loadStatus();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to enable all models');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable all models');
    } finally {
      setTogglingAll(null);
    }
  };

  const handleDisableAll = async () => {
    setTogglingAll('disable');
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/ollama/cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable-all' }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(data.message || 'All cloud models disabled');
        await loadStatus();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to disable all models');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable all models');
    } finally {
      setTogglingAll(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return 'Unknown';
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Get effective enabled state (DB state + pending changes)
  const getEffectiveEnabled = (modelId: string, dbEnabled: boolean): boolean => {
    if (pendingChanges.has(modelId)) {
      return pendingChanges.get(modelId)!;
    }
    return dbEnabled;
  };

  // Merge discovered models with db models to show status
  const mergedModels = [...discoveredModels.map(dm => {
    const dbModel = dbModels.find(dbm => dbm.id === dm.id);
    const dbEnabled = dbModel?.enabled ?? false;
    return {
      ...dm,
      enabled: getEffectiveEnabled(dm.id, dbEnabled),
      dbEnabled, // Original DB state for comparison
      inDb: !!dbModel,
    };
  })];

  // Add db models that aren't in discovered
  for (const dbm of dbModels) {
    if (!mergedModels.some(m => m.id === dbm.id)) {
      mergedModels.push({
        id: dbm.id,
        name: dbm.displayName,
        tag: dbm.id.split(':')[1] || 'latest',
        size: 0,
        digest: '',
        modified_at: '',
        is_cloud: true,
        enabled: getEffectiveEnabled(dbm.id, dbm.enabled),
        dbEnabled: dbm.enabled,
        inDb: true,
      });
    }
  }

  const enabledCount = dbModels.filter(m => m.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Cloud className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ollama Cloud Models</h2>
            <p className="text-sm text-gray-500">Manage cloud-hosted LLM models via ollama.com</p>
          </div>
        </div>
        
        {/* Configuration Status */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          {configured ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">
                API key configured
              </span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-700">
                No API key configured — add your Ollama Cloud API key in Settings &gt; LLM
              </span>
            </>
          )}
        </div>

        {/* Enabled Models Count */}
        {configured && dbModels.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              {enabledCount} model{enabledCount !== 1 ? 's' : ''} enabled for chat
            </span>
          </div>
        )}

        {/* Route 3 Warning */}
        {routesSettings && !routesSettings.route3Enabled && dbModels.length > 0 && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-orange-800">
                  Route 3 (Ollama) is disabled. Models won't appear in chat.
                </span>
              </div>
              <Button
                onClick={enableRoute3}
                disabled={enablingRoute3}
                size="sm"
                className="flex items-center gap-1"
              >
                {enablingRoute3 ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle className="w-3 h-3" />
                )}
                Enable Route 3
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Discover Models */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900">Discover Models</h3>
          <Button
            onClick={handleDiscover}
            disabled={!configured || discovering}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            {discovering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Discover
          </Button>
        </div>
        
        {!configured && (
          <p className="text-sm text-gray-500">
            Configure your Ollama Cloud API key in Settings &gt; LLM to discover available models.
          </p>
        )}

        {configured && discoveredModels.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Found {discoveredModels.length} model(s). Sync them to make available in chat.
            </p>
            <Button
              onClick={handleSyncModels}
              disabled={syncing}
              size="sm"
              className="flex items-center gap-2"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Sync All to Chat
            </Button>
          </div>
        )}
      </div>

      {/* Models List */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900">Models</h3>
          <div className="flex items-center gap-2">
            {/* Save button - only show when there are pending changes */}
            {pendingChanges.size > 0 && (
              <Button
                onClick={handleSaveChanges}
                disabled={saving}
                size="sm"
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                Save Changes ({pendingChanges.size})
              </Button>
            )}
            {dbModels.length > 0 && (
              <>
                <Button
                  onClick={handleEnableAll}
                  disabled={togglingAll !== null}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  {togglingAll === 'enable' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  Select All
                </Button>
                <Button
                  onClick={handleDisableAll}
                  disabled={togglingAll !== null}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  {togglingAll === 'disable' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  Deselect All
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Pending changes indicator */}
        {pendingChanges.size > 0 && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              You have {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? 's' : ''}. Click "Save Changes" to persist.
            </span>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : dbModels.length === 0 && discoveredModels.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Cloud className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No models configured</p>
            <p className="text-sm">Click "Discover" to find available models</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mergedModels.map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="font-medium text-gray-900">{model.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{model.id}</span>
                      {model.size > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatSize(model.size)}</span>
                        </>
                      )}
                      {model.details?.parameter_size && (
                        <>
                          <span>•</span>
                          <span>{model.details.parameter_size}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {model.inDb && (
                    <button
                      onClick={() => handleToggleModel(model.id, model.enabled)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        model.enabled
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {model.enabled ? (
                        <>
                          <ToggleRight className="w-4 h-4" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4" />
                          Disabled
                        </>
                      )}
                    </button>
                  )}
                  {!model.inDb && model.enabled === undefined && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                      Not synced
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}