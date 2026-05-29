#!/usr/bin/env npx tsx
/**
 * OpenAI-Compatible Proxy Server for Letta Integration
 *
 * Accepts OpenAI chat completions format and proxies through claude-code-sdk-ts.
 * Letta (and other OpenAI-compatible clients) can use this as their LLM backend.
 *
 * Usage:
 *   npm run proxy
 *   # or: npx tsx proxy-server.ts
 *
 * Then point Letta at http://localhost:4000/v1
 */

import express from 'express';
import { claude } from './dist/index.js';

// Remove env vars that prevent Claude CLI from running inside another Claude session
delete process.env.CLAUDECODE;
delete process.env.CLAUDE_CODE_ENTRYPOINT;
// Remove API key so CLI uses OAuth/subscription auth instead of paid API credits
delete process.env.ANTHROPIC_API_KEY;

const app = express();
app.use(express.json({ limit: '10mb' }));

// Log all incoming requests
app.use((req, _res, next) => {
  console.log(`[proxy] ${req.method} ${req.url}`);
  next();
});

const PORT = parseInt(process.env.PROXY_PORT || '4000', 10);
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'sonnet';

// ---------------------------------------------------------------------------
// GET /v1/models — model discovery
// ---------------------------------------------------------------------------
app.get(['/v1/models', '/models'], (_req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'claude-code',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// POST /v1/chat/completions — main endpoint
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

interface ChatCompletionRequest {
  model?: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  functions?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
  temperature?: number;
  max_tokens?: number;
}

app.post(['/v1/chat/completions', '/chat/completions'], async (req, res) => {
  const body = req.body as ChatCompletionRequest;
  const { messages, tools, functions } = body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: { message: 'messages array is required' } });
    return;
  }

  try {
    // Build a combined prompt from messages + tool definitions
    const prompt = buildPrompt(messages, tools, functions);

    console.log(`[proxy] Received request with ${messages.length} messages`);
    console.log(`[proxy] Tools: ${(tools || functions || []).length}`);

    // Query Claude via the SDK
    const text = await claude()
      .withModel(body.model || DEFAULT_MODEL)
      .skipPermissions()
      .debug()
      .query(prompt)
      .asText();

    console.log(`[proxy] Got response (${text.length} chars)`);

    // Try to detect if the response contains a function/tool call
    const toolCall = parseToolCall(text);

    const responseId = `chatcmpl-${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    if (toolCall) {
      // Return as a tool_calls response
      const toolCallId = `call_${Date.now()}`;
      res.json({
        id: responseId,
        object: 'chat.completion',
        created: timestamp,
        model: body.model || DEFAULT_MODEL,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: toolCallId,
                  type: 'function',
                  function: {
                    name: toolCall.name,
                    arguments: JSON.stringify(toolCall.arguments),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: Math.ceil(prompt.length / 4), completion_tokens: Math.ceil(text.length / 4), total_tokens: Math.ceil((prompt.length + text.length) / 4) },
      });
    } else {
      // Return as a plain content response
      res.json({
        id: responseId,
        object: 'chat.completion',
        created: timestamp,
        model: body.model || DEFAULT_MODEL,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: text,
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: Math.ceil(prompt.length / 4), completion_tokens: Math.ceil(text.length / 4), total_tokens: Math.ceil((prompt.length + text.length) / 4) },
      });
    }
  } catch (error) {
    console.error('[proxy] Error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'server_error',
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

function buildPrompt(
  messages: OpenAIMessage[],
  tools?: OpenAITool[],
  functions?: ChatCompletionRequest['functions']
): string {
  const parts: string[] = [];

  // Format tool definitions as instructions
  const toolDefs = tools
    ? tools.map((t) => t.function)
    : functions
      ? functions
      : [];

  if (toolDefs.length > 0) {
    parts.push('You have access to the following functions. To call a function, respond with ONLY a JSON object in this exact format (no other text before or after):');
    parts.push('');
    parts.push('```json');
    parts.push('{"function_call": {"name": "function_name", "arguments": {...}}}');
    parts.push('```');
    parts.push('');
    parts.push('Available functions:');
    for (const fn of toolDefs) {
      parts.push(`- ${fn.name}: ${fn.description || 'No description'}`);
      if (fn.parameters) {
        parts.push(`  Parameters: ${JSON.stringify(fn.parameters)}`);
      }
    }
    parts.push('');
    parts.push('If you want to respond to the user normally (not call a function), just write your response as plain text.');
    parts.push('---');
    parts.push('');
  }

  // Format conversation messages
  for (const msg of messages) {
    const content = msg.content || '';
    switch (msg.role) {
      case 'system':
        parts.push(`[System]: ${content}`);
        break;
      case 'user':
        parts.push(`[User]: ${content}`);
        break;
      case 'assistant':
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            parts.push(`[Assistant called ${tc.function.name}]: ${tc.function.arguments}`);
          }
        } else {
          parts.push(`[Assistant]: ${content}`);
        }
        break;
      case 'tool':
        parts.push(`[Tool result for ${msg.name || msg.tool_call_id || 'unknown'}]: ${content}`);
        break;
    }
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Tool call detection
// ---------------------------------------------------------------------------

interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

function parseToolCall(text: string): ParsedToolCall | null {
  // Try to find a function_call JSON block in the response
  // Look in code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonCandidate = codeBlockMatch ? codeBlockMatch[1]!.trim() : text.trim();

  try {
    const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;

    // Format: {"function_call": {"name": "...", "arguments": {...}}}
    if (parsed.function_call && typeof parsed.function_call === 'object') {
      const fc = parsed.function_call as Record<string, unknown>;
      if (typeof fc.name === 'string') {
        return {
          name: fc.name,
          arguments: (typeof fc.arguments === 'object' && fc.arguments !== null
            ? fc.arguments
            : {}) as Record<string, unknown>,
        };
      }
    }

    // Format: {"name": "...", "arguments": {...}} (direct)
    if (typeof parsed.name === 'string' && parsed.arguments !== undefined) {
      return {
        name: parsed.name,
        arguments: (typeof parsed.arguments === 'object' && parsed.arguments !== null
          ? parsed.arguments
          : {}) as Record<string, unknown>,
      };
    }
  } catch {
    // Not JSON or not a tool call — that's fine, return null
  }

  // Also try to find JSON embedded in surrounding text
  const jsonMatch = text.match(/\{[\s\S]*"function_call"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      if (parsed.function_call && typeof parsed.function_call === 'object') {
        const fc = parsed.function_call as Record<string, unknown>;
        if (typeof fc.name === 'string') {
          return {
            name: fc.name,
            arguments: (typeof fc.arguments === 'object' && fc.arguments !== null
              ? fc.arguments
              : {}) as Record<string, unknown>,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

import { createServer } from 'node:http';

const HOST = process.env.PROXY_HOST || '0.0.0.0';

const server = createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`[proxy] OpenAI-compatible proxy server running on http://${HOST}:${PORT}`);
  console.log(`[proxy] Model endpoint: http://${HOST}:${PORT}/v1/models`);
  console.log(`[proxy] Chat endpoint:  http://${HOST}:${PORT}/v1/chat/completions`);
  console.log(`[proxy] Using Claude model: ${DEFAULT_MODEL}`);
  console.log(`[proxy] Ready for Letta connections.`);
});
