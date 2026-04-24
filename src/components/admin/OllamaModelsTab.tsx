'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Download, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaStatus {
  connected: boolean;
  mode: 'docker' | 'system';
  error?: string;
}

interface PullJob {
  model: string;
  status: 'pending' | 'pulling' | 'success' | 'error';
  progress: number;
  totalSize: number;
  downloadedSize: number;
  error?: string;
  startedAt: string;
  updatedAt: string;
}

export default function OllamaModelsTab() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pullModelName, setPullModelName] = useState('');
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<PullJob[]>([]);
  const [syncStatus, setSyncStatus] = useState<{ synced: string[]; unsynced: string[] } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [routesSettings, setRoutesSettings] = useState<{ route3Enabled: boolean } | null>(null);
  const [enablingRoute3, setEnablingRoute3] = useState(false);
  
  // Use refs to track polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousJobsRef = useRef<PullJob[]>([]);

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ollama/models');
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
        setStatus(data.status || { connected: false, mode: 'docker' });
      } else {
        const data = await response.json();
        setStatus({ connected: false, mode: 'docker', error: data.error });
      }
    } catch (err) {
      setStatus({ connected: false, mode: 'docker', error: 'Failed to connect to Ollama' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Check which models are synced to the database
  const checkSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/ollama/sync');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus({ synced: data.synced || [], unsynced: data.unsynced || [] });
      }
    } catch (err) {
      console.error('Failed to check sync status:', err);
    }
  }, []);

  // Check routes settings
  const checkRoutesSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/routes');
      if (response.ok) {
        const data = await response.json();
        setRoutesSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to check routes settings:', err);
    }
  }, []);

  // Enable Route 3 for Ollama models
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
        setPullSuccess('Route 3 (Ollama) enabled! Models will now appear in chat.');
      } else {
        setPullError('Failed to enable Route 3');
      }
    } catch (err) {
      setPullError('Failed to enable Route 3');
    } finally {
      setEnablingRoute3(false);
    }
  };

  // Poll for active pull jobs
  const pollPullStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/ollama/pull/status');
      if (response.ok) {
        const data = await response.json();
        const jobs: PullJob[] = data.jobs || [];
        
        // Check if any previously active job is now gone (completed)
        const previousJobs = previousJobsRef.current;
        const wasPulling = previousJobs.length > 0;
        const isNowIdle = jobs.length === 0;
        
        // If we were pulling and now we're idle, a job finished
        if (wasPulling && isNowIdle) {
          console.log('[Ollama] Pull completed, refreshing models...');
          await loadModels();
          await checkSyncStatus();
        }
        
        // Also check for successful jobs still in the list
        const completedJobs = jobs.filter(job => job.status === 'success');
        if (completedJobs.length > 0) {
          await loadModels();
          await checkSyncStatus();
        }
        
        setActiveJobs(jobs);
        previousJobsRef.current = jobs;
      }
    } catch (err) {
      console.error('Failed to poll pull status:', err);
    }
  }, [loadModels, checkSyncStatus]);

  // Initial load
  useEffect(() => {
    loadModels();
    checkSyncStatus();
    checkRoutesSettings();
  }, []);

  // Sync Ollama models to the database (makes them available in chat)
  const handleSyncModels = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/ollama/sync', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        setPullSuccess(`Synced ${data.synced?.length || 0} models to chat. ${data.enabled?.length || 0} re-enabled.`);
        // Refresh sync status
        await checkSyncStatus();
      } else {
        setPullError(data.error || 'Failed to sync models');
      }
    } catch (err) {
      setPullError('Failed to sync models to chat');
    } finally {
      setSyncing(false);
    }
  };

  // Setup polling for pull status every 10 seconds
  useEffect(() => {
    // Poll immediately
    pollPullStatus();
    
    // Setup interval
    pollIntervalRef.current = setInterval(pollPullStatus, 10000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [pollPullStatus]);

  const handlePullModel = async () => {
    if (!pullModelName.trim()) return;
    
    setPulling(true);
    setPullError(null);
    setPullSuccess(null);
    
    try {
      const response = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: pullModelName.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setPullError(data.error || 'Failed to pull model');
      } else {
        if (data.message === 'Pull already in progress') {
          setPullSuccess(`Pull for ${pullModelName} is already in progress (${data.progress}%)`);
        } else {
          setPullSuccess(`Started pulling ${pullModelName} in background`);
        }
        setPullModelName('');
        // Immediately poll for status
        pollPullStatus();
      }
    } catch (err) {
      setPullError('Failed to pull model');
    } finally {
      setPulling(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Bot className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ollama Models</h2>
            <p className="text-sm text-gray-500">Manage local LLM models</p>
          </div>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          {status?.connected ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">
                Connected to Ollama ({status.mode} mode)
              </span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-700">
                {status?.error || 'Not connected to Ollama'}
              </span>
            </>
          )}
          <button
            onClick={loadModels}
            className="ml-auto p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        {/* Sync Status */}
        {syncStatus && syncStatus.unsynced.length > 0 && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  {syncStatus.unsynced.length} model{syncStatus.unsynced.length !== 1 ? 's' : ''} not available in chat
                </span>
              </div>
              <Button
                onClick={handleSyncModels}
                disabled={syncing}
                size="sm"
                className="flex items-center gap-1"
              >
                {syncing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Sync to Chat
              </Button>
            </div>
          </div>
        )}
        
        {syncStatus && syncStatus.unsynced.length === 0 && syncStatus.synced.length > 0 && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800">
              All {syncStatus.synced.length} model{syncStatus.synced.length !== 1 ? 's' : ''} available in chat
            </span>
          </div>
        )}
        
        {/* Route 3 Warning */}
        {routesSettings && !routesSettings.route3Enabled && syncStatus && (syncStatus.synced.length > 0 || syncStatus.unsynced.length > 0) && (
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

      {/* Active Pull Jobs */}
      {activeJobs.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Active Downloads</h3>
          <div className="space-y-4">
            {activeJobs.map((job) => (
              <div key={job.model} className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="font-medium text-gray-900">{job.model}</span>
                    <span className="text-xs text-gray-500">
                      {job.status === 'pending' ? 'Starting...' : 'Downloading...'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">
                    {job.progress}%
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>
                
                {/* Download Stats */}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatBytes(job.downloadedSize)} / {formatBytes(job.totalSize)}</span>
                  <span>Updated: {new Date(job.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Auto-refreshing every 10 seconds...
          </p>
        </div>
      )}

      {/* Pull New Model */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Pull New Model</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={pullModelName}
            onChange={(e) => setPullModelName(e.target.value)}
            placeholder="e.g., llama3.2, mistral, qwen2.5:7b"
            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handlePullModel()}
          />
          <Button
            onClick={handlePullModel}
            disabled={pulling || !pullModelName.trim()}
            className="flex items-center gap-2"
          >
            {pulling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Pull Model
          </Button>
        </div>
        
        {pullError && (
          <div className="mt-3 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{pullError}</span>
          </div>
        )}
        
        {pullSuccess && (
          <div className="mt-3 p-3 bg-green-50 text-green-600 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">{pullSuccess}</span>
          </div>
        )}
        
        <p className="mt-3 text-xs text-gray-500">
          Popular models: llama3.2, llama3.1, mistral, qwen2.5, gemma3, gemma4:2b, phi4
        </p>
      </div>

      {/* Installed Models */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Installed Models</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No models installed</p>
            <p className="text-sm">Pull a model above to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {models.map((model) => (
              <div
                key={model.name}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{model.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatSize(model.size)}</span>
                      {model.details?.parameter_size && (
                        <>
                          <span>•</span>
                          <span>{model.details.parameter_size}</span>
                        </>
                      )}
                      {model.details?.quantization_level && (
                        <>
                          <span>•</span>
                          <span>{model.details.quantization_level}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}