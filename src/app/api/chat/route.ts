import { query } from '@anthropic-ai/claude-agent-sdk'
import * as Sentry from '@sentry/nextjs'

const SYSTEM_PROMPT = `You are a helpful personal assistant designed to help with general research, questions, and tasks.

Your role is to:
- Answer questions on any topic accurately and thoroughly
- Help with research by searching the web for current information
- Assist with writing, editing, and brainstorming
- Provide explanations and summaries of complex topics
- Help solve problems and think through decisions

Guidelines:
- Be friendly, clear, and conversational
- Use web search when you need current information, facts you're unsure about, or real-time data
- Keep responses concise but complete - expand when the topic warrants depth
- Use markdown formatting when it helps readability (bullet points, code blocks, etc.)
- Be honest when you don't know something and offer to search for answers`

interface MessageInput {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  const requestStartTime = Date.now()

  // Log request start
  Sentry.logger.info('Chat API request started', {
    timestamp: new Date().toISOString(),
  })

  // Increment request counter
  Sentry.metrics.increment('chat.requests.total', 1, {
    tags: { endpoint: 'chat' }
  })

  try {
    const { messages } = await request.json() as { messages: MessageInput[] }

    if (!messages || !Array.isArray(messages)) {
      Sentry.logger.warn('Invalid request: messages array missing', {
        hasMessages: !!messages,
        isArray: Array.isArray(messages),
      })

      Sentry.metrics.increment('chat.requests.errors', 1, {
        tags: { error_type: 'invalid_input' }
      })

      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMessage) {
      Sentry.logger.warn('Invalid request: no user message found', {
        messageCount: messages.length,
      })

      Sentry.metrics.increment('chat.requests.errors', 1, {
        tags: { error_type: 'no_user_message' }
      })

      return new Response(
        JSON.stringify({ error: 'No user message found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Log message context
    Sentry.logger.info('Processing chat message', {
      messageCount: messages.length,
      userMessageLength: lastUserMessage.content.length,
    })

    // Track message metrics
    Sentry.metrics.distribution('chat.message.length', lastUserMessage.content.length, {
      tags: { type: 'user' },
      unit: 'character'
    })

    Sentry.metrics.distribution('chat.conversation.depth', messages.length, {
      tags: { endpoint: 'chat' },
      unit: 'message'
    })

    // Build conversation context
    const conversationContext = messages
      .slice(0, -1) // Exclude the last message since we pass it as the prompt
      .map((m: MessageInput) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const fullPrompt = conversationContext
      ? `${SYSTEM_PROMPT}\n\nPrevious conversation:\n${conversationContext}\n\nUser: ${lastUserMessage.content}`
      : `${SYSTEM_PROMPT}\n\nUser: ${lastUserMessage.content}`

    // Create a streaming response
    const encoder = new TextEncoder()
    const toolsUsed = new Set<string>()
    let totalTokens = 0
    let streamStartTime = Date.now()

    Sentry.logger.info('Starting Claude Agent SDK query', {
      promptLength: fullPrompt.length,
    })

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use the claude-agent-sdk query function with all default tools enabled
          for await (const message of query({
            prompt: fullPrompt,
            options: {
              maxTurns: 10,
              // Use the preset to enable all Claude Code tools including WebSearch
              tools: { type: 'preset', preset: 'claude_code' },
              // Bypass all permission checks for automated tool execution
              permissionMode: 'bypassPermissions',
              allowDangerouslySkipPermissions: true,
              // Enable partial messages for real-time text streaming
              includePartialMessages: true,
              // Set working directory to the app's directory for sandboxing
              cwd: process.cwd(),
            }
          })) {
            // Handle streaming text deltas (partial messages)
            if (message.type === 'stream_event' && 'event' in message) {
              const event = message.event
              // Handle content block delta events for text streaming
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'text_delta', text: event.delta.text })}\n\n`
                ))
              }
            }

            // Send tool start events from assistant messages
            if (message.type === 'assistant' && 'message' in message) {
              const content = message.message?.content
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'tool_use') {
                    toolsUsed.add(block.name)

                    Sentry.logger.info('Tool invoked', {
                      toolName: block.name,
                      toolId: block.id,
                    })

                    Sentry.metrics.increment('chat.tools.invoked', 1, {
                      tags: { tool: block.name }
                    })

                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({ type: 'tool_start', tool: block.name })}\n\n`
                    ))
                  }
                }
              }
            }

            // Send tool progress updates
            if (message.type === 'tool_progress') {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'tool_progress', tool: message.tool_name, elapsed: message.elapsed_time_seconds })}\n\n`
              ))
            }

            // Signal completion
            if (message.type === 'result' && message.subtype === 'success') {
              const streamDuration = Date.now() - streamStartTime

              Sentry.logger.info('Query completed successfully', {
                streamDuration,
                toolsUsed: Array.from(toolsUsed),
                toolCount: toolsUsed.size,
              })

              Sentry.metrics.distribution('chat.stream.duration', streamDuration, {
                tags: { status: 'success' },
                unit: 'millisecond'
              })

              Sentry.metrics.distribution('chat.tools.count', toolsUsed.size, {
                tags: { status: 'success' },
                unit: 'tool'
              })

              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'done' })}\n\n`
              ))
            }

            // Handle errors
            if (message.type === 'result' && message.subtype !== 'success') {
              Sentry.logger.error('Query did not complete successfully', {
                subtype: message.subtype,
              })

              Sentry.metrics.increment('chat.query.errors', 1, {
                tags: { error_type: 'incomplete' }
              })

              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'error', message: 'Query did not complete successfully' })}\n\n`
              ))
            }
          }

          const requestDuration = Date.now() - requestStartTime

          Sentry.logger.info('Chat request completed', {
            requestDuration,
            totalToolsUsed: toolsUsed.size,
          })

          Sentry.metrics.distribution('chat.request.duration', requestDuration, {
            tags: { status: 'success' },
            unit: 'millisecond'
          })

          Sentry.metrics.increment('chat.requests.success', 1, {
            tags: { endpoint: 'chat' }
          })

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          Sentry.logger.error('Stream error occurred', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          })

          Sentry.metrics.increment('chat.stream.errors', 1, {
            tags: { error_type: 'stream_error' }
          })

          Sentry.captureException(error)

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: 'Stream error occurred' })}\n\n`
          ))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const requestDuration = Date.now() - requestStartTime

    Sentry.logger.error('Chat API error occurred', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestDuration,
    })

    Sentry.metrics.increment('chat.requests.errors', 1, {
      tags: { error_type: 'api_error' }
    })

    Sentry.metrics.distribution('chat.request.duration', requestDuration, {
      tags: { status: 'error' },
      unit: 'millisecond'
    })

    Sentry.captureException(error)

    return new Response(
      JSON.stringify({ error: 'Failed to process chat request. Check server logs for details.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
