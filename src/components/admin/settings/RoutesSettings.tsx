'use client';

import { useState, useEffect } from 'react';
import { Route, AlertCircle, CheckCircle, Info } from 'lucide-react';
import Button from '@/components/ui/Button';

interface RoutesSettings {
  route1Enabled: boolean;
  route2Enabled: boolean;
  route3Enabled: boolean;
  primaryRoute: 'route1' | 'route2' | 'route3';
}

export default function RoutesSettings() {
  const [settings, setSettings] = useState<RoutesSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/routes');
      if (!response.ok) throw new Error('Failed to load routes settings');
      const data = await response.json();
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/admin/routes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route1Enabled: settings.route1Enabled,
          route2Enabled: settings.route2Enabled,
          route3Enabled: settings.route3Enabled,
          primaryRoute: settings.primaryRoute,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
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
        <p className="text-red-700">Failed to load routes settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="text-blue-600 mt-0.5" size={20} />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">Route Configuration</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Route 1 (OpenAI):</strong> Direct OpenAI API calls</li>
            <li><strong>Route 2 (LiteLLM Proxy):</strong> Multi-provider proxy for cloud models</li>
            <li><strong>Route 3 (Ollama):</strong> Local Ollama models</li>
          </ul>
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
          <p className="text-green-700">Routes settings saved successfully!</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Route 1 - OpenAI */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Route size={20} className="text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Route 1: OpenAI</h3>
                <p className="text-sm text-gray-500">Direct OpenAI API integration</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.route1Enabled}
                onChange={(e) => setSettings({ ...settings, route1Enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Route 2 - LiteLLM Proxy */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Route size={20} className="text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Route 2: LiteLLM Proxy</h3>
                <p className="text-sm text-gray-500">Multi-provider proxy for cloud models</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.route2Enabled}
                onChange={(e) => setSettings({ ...settings, route2Enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Route 3 - Ollama */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Route size={20} className="text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Route 3: Ollama (Local)</h3>
                <p className="text-sm text-gray-500">Local Ollama models for air-gapped deployment</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.route3Enabled}
                onChange={(e) => setSettings({ ...settings, route3Enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Primary Route Selection */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Primary Route</h3>
          <p className="text-sm text-gray-500 mb-4">Select the default route for LLM requests</p>
          
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="primaryRoute"
                value="route1"
                checked={settings.primaryRoute === 'route1'}
                onChange={(e) => setSettings({ ...settings, primaryRoute: e.target.value as 'route1' | 'route2' | 'route3' })}
                disabled={!settings.route1Enabled}
                className="w-4 h-4 text-blue-600"
              />
              <span className={!settings.route1Enabled ? 'text-gray-400' : 'text-gray-700'}>
                Route 1 (OpenAI)
              </span>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="primaryRoute"
                value="route2"
                checked={settings.primaryRoute === 'route2'}
                onChange={(e) => setSettings({ ...settings, primaryRoute: e.target.value as 'route1' | 'route2' | 'route3' })}
                disabled={!settings.route2Enabled}
                className="w-4 h-4 text-blue-600"
              />
              <span className={!settings.route2Enabled ? 'text-gray-400' : 'text-gray-700'}>
                Route 2 (LiteLLM Proxy)
              </span>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="primaryRoute"
                value="route3"
                checked={settings.primaryRoute === 'route3'}
                onChange={(e) => setSettings({ ...settings, primaryRoute: e.target.value as 'route1' | 'route2' | 'route3' })}
                disabled={!settings.route3Enabled}
                className="w-4 h-4 text-blue-600"
              />
              <span className={!settings.route3Enabled ? 'text-gray-400' : 'text-gray-700'}>
                Route 3 (Ollama Local)
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={saveSettings}
          loading={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Save Routes Settings
        </Button>
      </div>
    </div>
  );
}