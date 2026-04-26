'use client';

import { MessageCircle, Plus } from 'lucide-react';
import type { Thread } from '@/types';

interface WelcomeScreenProps {
  userRole: 'user' | 'superuser' | 'admin';
  brandingName: string;
  onNewThread?: (thread: Thread) => void;
}

export default function WelcomeScreen({
  brandingName,
}: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Welcome Icon */}
        <div className="flex justify-center">
          <div className="p-4 bg-blue-50 rounded-full">
            <MessageCircle size={48} className="text-blue-600" />
          </div>
        </div>

        {/* Welcome Message */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome to {brandingName}
          </h1>
          <p className="text-gray-600">
            Your AI assistant for intelligent conversations and document analysis
          </p>
        </div>

        {/* New Thread Prompt */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Plus size={20} className="text-blue-600" />
            <span className="font-medium text-gray-900">Start a New Conversation</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Click the &ldquo;New Thread&rdquo; button in the sidebar to begin chatting with your AI assistant
          </p>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 shadow-sm">
              <Plus size={16} />
              New Thread
            </div>
          </div>
        </div>

        {/* Quick Tip */}
        <p className="text-xs text-gray-400">
          Tip: You can upload documents, ask questions, and get AI-powered insights in every conversation
        </p>
      </div>
    </div>
  );
}