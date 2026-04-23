import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getApiBase } from '@/lib/provider-helpers';

/**
 * POST /api/ollama/pull
 * 
 * Pull a model from Ollama library
 * Body: { model: "gemma3:latest" }
 * 
 * Returns streaming progress updates
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { model } = body;

    if (!model || typeof model !== 'string') {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }

    const ollamaBase = await getApiBase('ollama');
    if (!ollamaBase) {
      return NextResponse.json({ error: 'Ollama not configured' }, { status: 500 });
    }

    // Call Ollama pull API with streaming
    const response = await fetch(`${ollamaBase}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Ollama pull error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Read the full response (Ollama returns JSON lines for streaming)
    const text = await response.text();
    
    // Parse the final status from the stream response
    // Ollama returns multiple JSON objects, the last one has status: "success"
    const lines = text.trim().split('\n');
    let lastStatus = '';
    let totalSize = 0;
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.status) {
          lastStatus = parsed.status;
        }
        if (parsed.total) {
          totalSize = parsed.total;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return NextResponse.json({
      success: lastStatus === 'success',
      model,
      status: lastStatus,
      totalSize,
    });
  } catch (error) {
    console.error('[Ollama Pull] Failed to pull model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pull model' },
      { status: 500 }
    );
  }
}