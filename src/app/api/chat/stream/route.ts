/**
 * Streaming Chat API
 *
 * SSE-based streaming endpoint for real-time chat responses.
 * Provides progressive disclosure of processing phases:
 * 1. RAG retrieval with skill/tool info
 * 2. Tool execution with status updates
 * 3. Final LLM response streaming
 */

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/auth';
import { getUserByEmail, linkOutputsToMessage, getEffectiveModelForThread } from '@/lib/db/compat';
import { getThread, addMessage, getMessages, getUploadDetails, getThreadCategorySlugsForQuery } from '@/lib/threads';
import { readFileBuffer } from '@/lib/storage';
import { getMemoryContext, processConversationForMemory } from '@/lib/memory';
import { countTokens, updateThreadTokenCount, shouldSummarize, summarizeThread, getThreadSummary, formatSummaryForContext } from '@/lib/summarization';
import { getMemorySettings, getSummarizationSettings } from '@/lib/db/compat';
import { runWithContextAsync } from '@/lib/request-context';
import { generateResponseWithTools } from '@/lib/openai';
import { recordTokenUsage } from '@/lib/token-logger';
import {
  createSSEEncoder,
  getSSEHeaders,
  getPhaseMessage,
  performRAGRetrieval,
  getStreamingConfigMs,
} from '@/lib/streaming';
import { TONE_PRESETS } from '@/types/stream';
import type { Message, StreamEvent, StreamChatRequest, Source, MessageVisualization, GeneratedDocumentInfo, GeneratedImageInfo, ImageContent } from '@/types';
import { isToolEnabled } from '@/lib/tools';
import { getImageCapabilities } from '@/lib/config-capability-checker';
import { getLlmSettings } from '@/lib/db/compat';
import {
  buildModelsToTry,
  withModelFallback,
  LlmFallbackError,
  type ModelSwitchEvent,
} from '@/lib/llm-fallback';

// Route segment config for long-running autonomous tasks
// 1800s (30 min) matches Traefik proxy timeout for autonomous mode.
// The admin UI "Streaming Configuration" controls the inner app-level timeout (default 300s).
export const maxDuration = 1800;

export async function POST(request: NextRequest) {
  const encoder = createSSEEncoder();
  let keepAliveInterval: NodeJS.Timeout | null = null;

  // Get streaming config from database (with fallback defaults)
  const streamingConfig = await getStreamingConfigMs();

  const stream = new ReadableStream({
    async start(controller) {
      let controllerClosed = false;
      const safeClose = () => {
        if (!controllerClosed) {
          controllerClosed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      };

      // Helper to send SSE events
      const send = (event: StreamEvent) => {
        if (controllerClosed) return;
        try {
          controller.enqueue(encoder.encode(event));
        } catch {
          // Controller closed, ignore
        }
      };

      // Setup keep-alive ping (interval from admin config)
      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.keepAlive());
        } catch {
          // Controller closed
        }
      }, streamingConfig.KEEPALIVE_INTERVAL_MS);

      // Handle client abort
      const cleanup = () => {
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      };

      request.signal.addEventListener('abort', cleanup);

      try {
        // ============ Phase 1: Authentication & Validation ============
        const user = await getCurrentUser();
        if (!user) {
          send({ type: 'error', code: 'AUTH_ERROR', message: 'Unauthorized', recoverable: false });
          cleanup();
          safeClose();
          return;
        }

        const body = await request.json() as StreamChatRequest;
        const {
          message,
          threadId,
          mode = 'normal',
          webSearchEnabled = true,
          targetLanguage = 'en',
          responseTone = 'default',
        } = body;

        if (!message || !threadId) {
          send({ type: 'error', code: 'VALIDATION_ERROR', message: 'Missing required fields', recoverable: false });
          cleanup();
          safeClose();
          return;
        }

        // Validate mode
        if (mode !== 'normal' && mode !== 'autonomous') {
          send({ type: 'error', code: 'VALIDATION_ERROR', message: 'Invalid mode', recoverable: false });
          cleanup();
          safeClose();
          return;
        }

        // Verify thread ownership
        const thread = await getThread(user.id, threadId);
        if (!thread) {
          send({ type: 'error', code: 'VALIDATION_ERROR', message: 'Thread not found', recoverable: false });
          cleanup();
          safeClose();
          return;
        }

        // Resolve effective model for this thread (thread override or global default)
        const effectiveModel = await getEffectiveModelForThread(threadId);
        const requestStart = Date.now();

        send({ type: 'status', phase: 'init', content: getPhaseMessage('init') });

        // ============ Setup ============
        const dbUser = await getUserByEmail(user.email);
        const memorySettings = await getMemorySettings();
        const summarizationSettings = await getSummarizationSettings();

        // Create and save user message
        const userMessageId = uuidv4();
        const userMessage: Message = {
          id: userMessageId,
          role: 'user',
          content: message,
          timestamp: new Date(),
        };
        await addMessage(user.id, threadId, userMessage);
        await updateThreadTokenCount(threadId, countTokens(message));

        // Autonomous mode removed in local-only version
        if (mode === 'autonomous') {
          send({ type: 'error', code: 'FEATURE_DISABLED', message: 'Autonomous mode is not available in local deployment', recoverable: false });
          cleanup();
          safeClose();
          return;
        }

        // Get conversation history
        const conversationHistory = await getMessages(user.id, threadId, 50);
        const categorySlugs = await getThreadCategorySlugsForQuery(threadId);
        const categoryIds = thread.categories?.map(c => c.id) || [];

        // Get memory and summary context
        let memoryContext = '';
        if (memorySettings.enabled && dbUser) {
          memoryContext = await getMemoryContext(dbUser.id, categoryIds);
        }

        let summaryContext = '';
        const existingSummary = await getThreadSummary(threadId);
        if (existingSummary) {
          summaryContext = formatSummaryForContext(existingSummary.summary);
        }

        if (memoryContext) {
          send({ type: 'operation_log', category: 'memory', message: 'Loading user memory' });
        }
        if (summaryContext) {
          send({ type: 'operation_log', category: 'memory', message: 'Loading conversation summary' });
        }

        // Get user uploads - separate images from documents
        const uploadDetails = await getUploadDetails(user.id, threadId);

        // Check image processing capabilities for the actual model being used
        const llmSettings = await getLlmSettings();
        const imageCapabilities = await getImageCapabilities(effectiveModel || llmSettings.model);

        // Document paths for RAG text extraction (PDFs, DOCX, etc.)
        // Also include images for OCR text extraction as additional context
        const allDocPaths = [
          ...uploadDetails.documents.map(d => d.filepath),
          ...uploadDetails.images.map(i => i.filepath), // Images also get OCR text extraction
        ];

        // Load images as base64 for multimodal visual content (only if vision is supported)
        const imageContents: ImageContent[] = [];

        if (uploadDetails.images.length > 0) {
          if (!imageCapabilities.canProcessImages) {
            // Scenario 1: No vision, no OCR - warn user
            send({
              type: 'status',
              phase: 'rag',
              content: `⚠️ Images cannot be processed. ${imageCapabilities.message}`,
            });
          } else if (imageCapabilities.strategy === 'ocr-only') {
            // Scenario 2: OCR only - inform user
            send({
              type: 'status',
              phase: 'rag',
              content: `ℹ️ ${imageCapabilities.message}`,
            });
          }

          // Only load images for LLM if vision is supported
          if (imageCapabilities.hasVisionSupport) {
            for (const img of uploadDetails.images) {
              try {
                const buffer = await readFileBuffer(img.filepath);
                imageContents.push({
                  base64: buffer.toString('base64'),
                  mimeType: img.mimeType,
                  filename: img.filename,
                });
              } catch (err) {
                console.warn(`Failed to load image ${img.filename}:`, err);
              }
            }
          }
        }

        // Create assistant message ID for context
        const assistantMessageId = uuidv4();

        // ============ Run with request context ============
        await runWithContextAsync(
          {
            threadId,
            messageId: assistantMessageId,
            categoryIds: categoryIds,
            userId: user.id,
            userMessage: message,
          },
          async () => {
            // ============ Phase 2: RAG Retrieval ============
            send({ type: 'status', phase: 'rag', content: getPhaseMessage('rag') });

            const ragStart = Date.now();
            const ragResult = await performRAGRetrieval(
              message,
              categorySlugs,
              allDocPaths,
              memoryContext,
              summaryContext,
              send,
              conversationHistory  // Pass for follow-up context boosting
            );
            const ragMs = Date.now() - ragStart;

            // Send sources from RAG
            send({ type: 'sources', data: ragResult.sources });

            // Preflight clarification removed in local-only version
            const enableClarification = false;
            const clarificationTimeoutMs = 120000;
            const clarificationSkillName: string | undefined = undefined;

            // ============ Build Model Fallback Chain ============
            // Determine models to try based on capabilities and health status
            const hasImages = imageContents.length > 0;
            const { models: modelsToTry, capabilitySwitch } = await buildModelsToTry(
              effectiveModel,
              hasImages,  // requiresVision
              true        // requiresTools (generally enabled)
            );

            // Notify if capability-based switch occurred (e.g., non-vision model with images)
            if (capabilitySwitch) {
              send({
                type: 'model_switch',
                originalModel: capabilitySwitch.originalModel,
                newModel: capabilitySwitch.newModel,
                reason: capabilitySwitch.reason,
                message: `Switched to ${capabilitySwitch.newModel} (${capabilitySwitch.reason.replace('_', ' ')})`,
              });
            }

            // Handle edge case: no models available
            if (modelsToTry.length === 0) {
              send({
                type: 'error',
                code: 'NO_MODELS_AVAILABLE',
                message: 'No LLM models available. Please contact your administrator to configure a fallback model.',
                recoverable: false,
              });
              return;
            }

            // ============ Phase 3: Tool Execution ============
            send({ type: 'status', phase: 'tools', content: getPhaseMessage('tools') });

            // Track collected artifacts
            const visualizations: MessageVisualization[] = [];
            const documents: GeneratedDocumentInfo[] = [];
            const images: GeneratedImageInfo[] = [];
            const webSources: Source[] = [];

            // Prepare system prompt with tone injection if needed
            let effectiveSystemPrompt = ragResult.systemPrompt;
            if (responseTone && responseTone !== 'default' && TONE_PRESETS[responseTone]) {
              const tonePrompt = TONE_PRESETS[responseTone].prompt;
              effectiveSystemPrompt = `${tonePrompt}\n\n${ragResult.systemPrompt}`;
            }

            // Clarification feature removed in local-only version

            // Determine which tools to exclude based on user preferences
            const excludeTools: string[] = [];
            if (!webSearchEnabled) {
              excludeTools.push('web_search');
            }

            // Execute tools with streaming callbacks and automatic fallback
            // Pass images for multimodal visual analysis (in addition to OCR text in context)
            // Uses conversation context manager for smart history (anchors + recent),
            // follow-up detection, and context-aware cache keys
            const llmStart = Date.now();

            // Define streaming callbacks
            const callbacks = {
              // For English responses: forward content tokens directly to the client as they
              // are generated (true streaming). For non-English: omit so tokens accumulate
              // internally and can be translated before delivery.
              onChunk: (targetLanguage && targetLanguage !== 'en')
                ? undefined
                : (text: string) => send({ type: 'chunk', content: text }),
              onThinkingChunk: (text: string) => send({ type: 'thinking_chunk', content: text }),
              onToolStart: (name: string, displayName: string) => {
                send({ type: 'tool_start', name, displayName });
              },
              onToolEnd: (name: string, success: boolean, duration: number, error?: string) => {
                send({ type: 'tool_end', name, success, duration, error });
              },
              onArtifact: (type: 'visualization' | 'document' | 'image', data: MessageVisualization | GeneratedDocumentInfo | GeneratedImageInfo) => {
                if (type === 'visualization') {
                  const viz = data as MessageVisualization;
                  visualizations.push(viz);
                  send({ type: 'artifact', subtype: 'visualization', data: viz });
                } else if (type === 'document') {
                  const doc = data as GeneratedDocumentInfo;
                  documents.push(doc);
                  send({ type: 'artifact', subtype: 'document', data: doc });
                } else if (type === 'image') {
                  const img = data as GeneratedImageInfo;
                  images.push(img);
                  send({ type: 'artifact', subtype: 'image', data: img });
                }
              },
              // Clarification feature removed in local-only version
              onClarification: undefined,
            };

            // Track which model was actually used
            let usedModel: string = modelsToTry[0];
            let toolResult: Awaited<ReturnType<typeof generateResponseWithTools>>;

            try {
              const fallbackResult = await withModelFallback({
                modelsToTry,
                execute: (model) => generateResponseWithTools(
                  effectiveSystemPrompt,
                  conversationHistory.slice(0, -1), // Full history, context manager optimizes
                  ragResult.context,
                  message,
                  true, // Enable tools
                  ragResult.categoryIds,
                  callbacks,
                  imageContents.length > 0 ? imageContents : undefined,
                  summaryContext, // Summary context for dynamic positioning
                  memoryContext, // Memory context for cache key
                  categorySlugs, // Category slugs for cache key
                  excludeTools,
                  imageCapabilities, // Image processing strategy
                  model, // Model to use (may change on fallback)
                  enableClarification // Inject request_clarification tool when preflight skill active
                ),
                onSwitch: (event: ModelSwitchEvent) => {
                  // Signal client to discard any partial streamed content from the failed model
                  send({ type: 'stream_reset' });
                  send({
                    type: 'model_switch',
                    originalModel: event.originalModel,
                    newModel: event.newModel,
                    reason: event.reason,
                    message: `${event.originalModel} unavailable, switching to ${event.newModel}`,
                  });
                },
                context: { threadId, userId: user.id },
              });

              toolResult = fallbackResult.result;
              usedModel = fallbackResult.usedModel;
            } catch (error) {
              if (error instanceof LlmFallbackError) {
                send({
                  type: 'error',
                  code: error.code as 'NO_MODELS_AVAILABLE' | 'ALL_MODELS_FAILED',
                  message: error.message,
                  recoverable: error.recoverable,
                });
                return;
              }
              throw error; // Re-throw non-fallback errors
            }

            const llmMs = Date.now() - llmStart;

            // Extract web sources from tool history
            for (const msg of toolResult.fullHistory) {
              if (msg.role === 'tool') {
                try {
                  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                  const parsed = JSON.parse(content);
                  if (parsed.results && Array.isArray(parsed.results)) {
                    for (const result of parsed.results) {
                      webSources.push({
                        documentName: `[WEB] ${result.title || result.url}`,
                        pageNumber: 0,
                        chunkText: result.content?.substring(0, 200) || '',
                        score: result.score || 0,
                      });
                    }
                  }
                } catch {
                  // Not a web search result
                }
              }
            }

            // Combine all sources
            const allSources = [...ragResult.sources, ...webSources];

            // ============ Phase 4: Finalize Content ============
            // Content tokens were already streamed token-by-token via onChunk
            // during generateResponseWithTools above — no further action needed.
            // Translation feature removed in local-only version.

            const fullContent = toolResult.content;

            // Compliance checking removed in local-only version

            // ============ Save & Cleanup ============
            const completionTokens = toolResult.totalTokens || countTokens(fullContent);
            const assistantMessage: Message = {
              id: assistantMessageId,
              role: 'assistant',
              content: fullContent,
              sources: allSources,
              generatedDocuments: documents.length > 0 ? documents : undefined,
              generatedImages: images.length > 0 ? images : undefined,
              visualizations: visualizations.length > 0 ? visualizations : undefined,
              timestamp: new Date(),
              metadata: {
                model: usedModel,
                totalMs: Date.now() - requestStart,
                llmMs,
                ragMs,
                completionTokens,
                tokensEstimated: !toolResult.totalTokens,
              },
            };

            await addMessage(user.id, threadId, assistantMessage);
            await updateThreadTokenCount(threadId, countTokens(fullContent));

            // Link any generated outputs (documents, images) to this message
            // This must happen after addMessage since message_id is a foreign key
            if (documents.length > 0 || images.length > 0) {
              try {
                await linkOutputsToMessage(threadId, assistantMessageId);
              } catch (linkError) {
                // Log but don't fail - message is saved, just outputs not linked
                console.error('[Stream] Failed to link outputs to message:', linkError);
              }
            }

            // Background tasks (non-blocking)
            if (summarizationSettings.enabled && await shouldSummarize(threadId)) {
              summarizeThread(threadId).catch(() => {});
            }

            if (memorySettings.enabled && memorySettings.autoExtractOnThreadEnd && dbUser) {
              const recentMessages = conversationHistory.slice(-10).map(m => ({
                role: m.role,
                content: m.content,
              }));
              processConversationForMemory(dbUser.id, categoryIds[0] || null, recentMessages).catch(() => {});
            }

            // Log token usage for dashboard
            recordTokenUsage({
              userId: dbUser?.id,
              category: 'chat',
              model: usedModel,
              totalTokens: toolResult.totalTokens,
            });

            // Send completion with metadata
            send({
              type: 'done',
              messageId: assistantMessageId,
              threadId,
              model: usedModel,
              totalMs: Date.now() - requestStart,
              llmMs,
              ragMs,
              completionTokens,
              tokensEstimated: !toolResult.totalTokens,
            });
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        send({ type: 'error', code: 'UNKNOWN_ERROR', message, recoverable: false });
      } finally {
        cleanup();
        safeClose();
      }
    },
  });

  return new Response(stream, { headers: getSSEHeaders() });
}
