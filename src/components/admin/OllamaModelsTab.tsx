'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Download, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
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

export default function OllamaModelsTab() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pullModelName, setPullModelName] = useState('');
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    loadModels();
  }, [loadModels]);

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
        setPullSuccess(`Successfully pulled ${pullModelName}`);
        setPullModelName('');
        // Reload models after pull
        await loadModels();
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
      </div>

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