'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import ChatWindow, { type ChatWindowRef } from '@/components/chat/ChatWindow';
import ThreadSidebar, { type ThreadSidebarRef } from '@/components/layout/ThreadSidebar';
import ArtifactsPanel from '@/components/chat/ArtifactsPanel';
import AppHeader from '@/components/layout/AppHeader';
import AppFooter from '@/components/layout/AppFooter';
import WelcomeScreen from '@/components/chat/WelcomeScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Thread, UserSubscription, GeneratedDocumentInfo, GeneratedImageInfo, UrlSource } from '@/types';

export default function Home() {
  const { data: session } = useSession();
  const chatWindowRef = useRef<ChatWindowRef>(null);
  const sidebarRef = useRef<ThreadSidebarRef>(null);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>([]);
  const [brandingName, setBrandingName] = useState<string>('Policy Bot');

  // Artifacts state (lifted from ChatWindow)
  const [artifactsData, setArtifactsData] = useState<{
    threadId: string | null;
    uploads: string[];
    generatedDocs: GeneratedDocumentInfo[];
    generatedImages: GeneratedImageInfo[];
    urlSources: UrlSource[];
  }>({
    threadId: null,
    uploads: [],
    generatedDocs: [],
    generatedImages: [],
    urlSources: [],
  });

  // Load user subscriptions and branding on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load user subscriptions
        const subsResponse = await fetch('/api/user/subscriptions');
        if (subsResponse.ok) {
          const subsData = await subsResponse.json();
          setUserSubscriptions(subsData.subscriptions || []);
        }

        // Load branding
        const brandingResponse = await fetch('/api/branding');
        if (brandingResponse.ok) {
          const brandingData = await brandingResponse.json();
          setBrandingName(brandingData.botName || 'Policy Bot');
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      }
    };
    loadData();
  }, []);

  const handleThreadSelect = useCallback((thread: Thread | null) => {
    setActiveThread(thread);
  }, []);

  const handleThreadCreated = useCallback((thread: Thread) => {
    setActiveThread(thread);
  }, []);

  const handleArtifactsChange = useCallback((data: {
    threadId: string | null;
    uploads: string[];
    generatedDocs: GeneratedDocumentInfo[];
    generatedImages: GeneratedImageInfo[];
    urlSources: UrlSource[];
  }) => {
    setArtifactsData(data);
  }, []);

  const handleRemoveUpload = useCallback(async (filename: string) => {
    if (!artifactsData.threadId) return;

    try {
      const response = await fetch(
        `/api/threads/${artifactsData.threadId}/upload?filename=${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        chatWindowRef.current?.removeUpload(filename);
        setArtifactsData(prev => ({
          ...prev,
          uploads: prev.uploads.filter(f => f !== filename),
        }));
      } else {
        const error = await response.json();
        console.error('Failed to delete upload:', error);
      }
    } catch (err) {
      console.error('Failed to delete upload:', err);
    }
  }, [artifactsData.threadId]);

  const handleRemoveUrlSource = useCallback(async (filename: string) => {
    if (!artifactsData.threadId) return;

    try {
      const response = await fetch(
        `/api/threads/${artifactsData.threadId}/upload?filename=${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        chatWindowRef.current?.removeUrlSource(filename);
        setArtifactsData(prev => ({
          ...prev,
          urlSources: prev.urlSources.filter(s => s.filename !== filename),
        }));
      } else {
        const error = await response.json();
        console.error('Failed to delete URL source:', error);
      }
    } catch (err) {
      console.error('Failed to delete URL source:', err);
    }
  }, [artifactsData.threadId]);

  // Get user role for WelcomeScreen
  const userRole = (session?.user as { role?: string })?.role as 'user' | 'superuser' | 'admin' | undefined;

  return (
    <div className="fixed-layout bg-gray-50">
      {/* Header */}
        <AppHeader
          title={brandingName}
          activeThread={activeThread}
          onNewThread={() => handleThreadCreated}
          onHomeClick={() => setActiveThread(null)}
        />

      {/* Content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <ThreadSidebar
          ref={sidebarRef}
          onThreadSelect={handleThreadSelect}
          onThreadCreated={() => handleThreadCreated}
          selectedThreadId={activeThread?.id}
        />

        {/* Main content area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {activeThread ? (
            <ErrorBoundary moduleName="ChatWindow">
              <ChatWindow
                ref={chatWindowRef}
                activeThread={activeThread}
                onThreadCreated={handleThreadCreated}
                userSubscriptions={userSubscriptions}
                brandingName={brandingName}
                onArtifactsChange={handleArtifactsChange}
              />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary moduleName="WelcomeScreen">
              <WelcomeScreen
                userRole={userRole || 'user'}
                brandingName={brandingName}
                onNewThread={handleThreadCreated}
              />
            </ErrorBoundary>
          )}
        </main>

        {/* Right sidebar */}
        <ArtifactsPanel
          threadId={artifactsData.threadId}
          uploads={artifactsData.uploads}
          generatedDocs={artifactsData.generatedDocs}
          generatedImages={artifactsData.generatedImages}
          urlSources={artifactsData.urlSources}
          onRemoveUpload={handleRemoveUpload}
          onRemoveUrlSource={handleRemoveUrlSource}
        />
      </div>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}