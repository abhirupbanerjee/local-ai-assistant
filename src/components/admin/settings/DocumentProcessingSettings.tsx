'use client';

import { useState, useEffect } from 'react';
import { FileText, AlertCircle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

interface UploadLimits {
  maxFilesPerInput: number;
  maxFilesPerThread: number;
  maxFileSizeMB: number;
  allowedTypes: string[];
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_FILE_TYPES = [
  { type: 'application/pdf', label: 'PDF', extension: '.pdf' },
  { type: 'text/plain', label: 'Text', extension: '.txt' },
  { type: 'text/markdown', label: 'Markdown', extension: '.md' },
  { type: 'text/html', label: 'HTML', extension: '.html' },
  { type: 'application/msword', label: 'Word (DOC)', extension: '.doc' },
  { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word (DOCX)', extension: '.docx' },
  { type: 'application/vnd.ms-excel', label: 'Excel (XLS)', extension: '.xls' },
  { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel (XLSX)', extension: '.xlsx' },
  { type: 'application/vnd.ms-powerpoint', label: 'PowerPoint (PPT)', extension: '.ppt' },
  { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'PowerPoint (PPTX)', extension: '.pptx' },
  { type: 'image/jpeg', label: 'JPEG Image', extension: '.jpg' },
  { type: 'image/png', label: 'PNG Image', extension: '.png' },
  { type: 'image/tiff', label: 'TIFF Image', extension: '.tiff' },
  { type: 'image/webp', label: 'WebP Image', extension: '.webp' },
  { type: 'application/json', label: 'JSON', extension: '.json' },
  { type: 'text/csv', label: 'CSV', extension: '.csv' },
  { type: 'text/xml', label: 'XML', extension: '.xml' },
  { type: 'application/rtf', label: 'RTF', extension: '.rtf' },
];

export default function DocumentProcessingSettingsTab() {
  const [settings, setSettings] = useState<UploadLimits | null>(null);
  const [originalSettings, setOriginalSettings] = useState<UploadLimits | null>(null);
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
      
      if (data.uploadLimits) {
        setSettings(data.uploadLimits);
        setOriginalSettings(data.uploadLimits);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof UploadLimits, value: number | string[]) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    setModified(JSON.stringify(newSettings) !== JSON.stringify(originalSettings));
  };

  const toggleFileType = (type: string) => {
    if (!settings) return;
    const currentTypes = settings.allowedTypes || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    handleChange('allowedTypes', newTypes);
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
          type: 'uploadLimits',
          settings: {
            maxFilesPerInput: settings.maxFilesPerInput,
            maxFilesPerThread: settings.maxFilesPerThread,
            maxFileSizeMB: settings.maxFileSizeMB,
            allowedTypes: settings.allowedTypes,
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
        <p className="text-red-700">Failed to load document processing settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="text-blue-600 mt-0.5" size={20} />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">Document Processing Configuration</p>
          <p>Configure file upload limits and allowed document types for processing.</p>
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
          <p className="text-green-700">Document processing settings saved successfully!</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 space-y-6">
        {/* Max Files Per Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Files Per Input: {settings.maxFilesPerInput}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={settings.maxFilesPerInput}
            onChange={(e) => handleChange('maxFilesPerInput', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum number of files users can upload in a single message
          </p>
        </div>

        {/* Max Files Per Thread */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Files Per Thread: {settings.maxFilesPerThread}
          </label>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={settings.maxFilesPerThread}
            onChange={(e) => handleChange('maxFilesPerThread', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum total files allowed in a single conversation thread
          </p>
        </div>

        {/* Max File Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max File Size: {settings.maxFileSizeMB} MB
          </label>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={settings.maxFileSizeMB}
            onChange={(e) => handleChange('maxFileSizeMB', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum size for individual files (in megabytes)
          </p>
        </div>

        {/* Allowed File Types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Allowed File Types
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DEFAULT_FILE_TYPES.map((fileType) => (
              <label
                key={fileType.type}
                className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={settings.allowedTypes?.includes(fileType.type) || false}
                  onChange={() => toggleFileType(fileType.type)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{fileType.label}</div>
                  <div className="text-xs text-gray-500">{fileType.extension}</div>
                </div>
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Select which file types users are allowed to upload
          </p>
        </div>

        {/* Quick Select Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleChange('allowedTypes', DEFAULT_FILE_TYPES.map(f => f.type))}
            className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => handleChange('allowedTypes', [])}
            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Deselect All
          </button>
          <button
            onClick={() => handleChange('allowedTypes', ['application/pdf', 'text/plain', 'text/markdown'])}
            className="px-3 py-1.5 text-sm text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          >
            Common Only (PDF, Text, MD)
          </button>
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
          Save Document Settings
        </Button>
      </div>
    </div>
  );
}