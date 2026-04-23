'use client';

import { Bot } from 'lucide-react';
import Link from 'next/link';
import type { Thread } from '@/types';

interface AppHeaderProps {
  title: string;
  activeThread?: Thread | null;
  onNewThread?: () => void;
  onHomeClick?: () => void;
}

export default function AppHeader({
  title,
  activeThread,
  onNewThread,
  onHomeClick,
}: AppHeaderProps) {
  // Default: centered logo header
  return (
    <header className="shrink-0 bg-white border-b px-4 py-3 shadow-sm">
      <div className="flex items-center justify-center">
        <Link
          href="/chat"
          onClick={onHomeClick}
          className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
        >
          <Bot size={24} className="text-blue-600" />
          <span>{title}</span>
        </Link>
      </div>
    </header>
  );
}