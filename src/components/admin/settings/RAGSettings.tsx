'use client';

import { useState, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

interface RagSettings {
  topKChunks: number;
  maxContextChunks: number;
  similarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
  queryExpansionEnabled: boolean;
  cacheEnabled: boolean;
  cacheTTLSeconds: number;
  updatedAt?: string;
  updatedBy?: string;
}

export default function RAGSettingsTab() {
  const [settings, setSettings] = useState<RagSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<RagSettings | null>(null);
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
      
      if (data.rag) {
        setSettings(data.rag);
        setOriginalSettings(data.rag);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof RagSettings, value: number | boolean) => {
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
          type: 'rag',
          settings: {
            topKChunks: settings.topKChunks,
            maxContextChunks: settings.maxContextChunks,
            similarityThreshold: settings.similarityThreshold,
            chunkSize: settings.chunkSize,
            chunkOverlap: settings.chunkOverlap,
            queryExpansionEnabled: settings.queryExpansionEnabled,
            cacheEnabled: settings.cacheEnabled,
            cacheTTLSeconds: settings.cacheTTLSeconds,
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
        <p className="text-red-700">Failed to load RAG settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="text-blue-600 mt-0.5" size={20} />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">RAG Configuration</p>
          <p>Configure Retrieval-Augmented Generation settings for document search and context injection.</p>
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
          <p className="text-green-700">RAG settings saved successfully!</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 space-y-6">
        {/* Top K Chunks */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Top K Chunks: {settings.topKChunks}
          </label>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={settings.topKChunks}
            onChange={(e) => handleChange('topKChunks', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Number of top chunks to retrieve from vector search
          </p>
        </div>

        {/* Max Context Chunks */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Context Chunks: {settings.maxContextChunks}
          </label>
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={settings.maxContextChunks}
            onChange={(e) => handleChange('maxContextChunks', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum chunks to include in LLM context
          </p>
        </div>

        {/* Similarity Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Similarity Threshold: {settings.similarityThreshold.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.similarityThreshold}
            onChange={(e) => handleChange('similarityThreshold', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Minimum similarity score for chunks (0 = any match, 1 = exact match)
          </p>
        </div>

        {/* Chunk Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chunk Size: {settings.chunkSize} characters
          </label>
          <input
            type="range"
            min="500"
            max="3000"
            step="100"
            value={settings.chunkSize}
            onChange={(e) => handleChange('chunkSize', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Size of each document chunk during ingestion
          </p>
        </div>

        {/* Chunk Overlap */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chunk Overlap: {settings.chunkOverlap} characters
          </label>
          <input
            type="range"
            min="0"
            max="500"
            step="50"
            value={settings.chunkOverlap}
            onChange={(e) => handleChange('chunkOverlap', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Overlap between consecutive chunks to maintain context
          </p>
        </div>

        {/* Query Expansion */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="font-medium text-gray-900">Query Expansion</h3>
            <p className="text-sm text-gray-500">Expand queries with synonyms for better retrieval</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.queryExpansionEnabled}
              onChange={(e) => handleChange('queryExpansionEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Cache Enabled */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="font-medium text-gray-900">RAG Cache</h3>
            <p className="text-sm text-gray-500">Cache RAG results for similar queries</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.cacheEnabled}
              onChange={(e) => handleChange('cacheEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Cache TTL */}
        {settings.cacheEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cache TTL: {settings.cacheTTLSeconds} seconds
            </label>
            <input
              type="number"
              min="60"
              max="86400"
              step="60"
              value={settings.cacheTTLSeconds}
              onChange={(e) => handleChange('cacheTTLSeconds', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              How long to cache RAG results (in seconds)
            </p>
          </div>
        )}
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
          Save RAG Settings
        </Button>
      </div>
    </div>
  );
}