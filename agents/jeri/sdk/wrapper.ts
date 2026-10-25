import { claude } from '@instantlyeasy/claude-code-sdk-ts';
import type { IStreamSink } from '../interfaces/claude.js';
import type { Message } from '@instantlyeasy/claude-code-sdk-ts';

// Convenience wrapper for running a single capability prompt with streaming.
// Used directly by capabilities that want minimal boilerplate.
export async function runCapabilityPrompt(
  prompt: string,
  opts: {
    model?: string;
    systemPrompt?: string;
    onChunk?: (chunk: string) => void;
  } = {},
): Promise<string> {
  const model = opts.model ?? 'claude-sonnet-4-6-20250514';
  const fullPrompt = opts.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt;

  const builder = claude().withModel(model).allowTools();

  if (opts.onChunk) {
    let full = '';
    await builder.query(fullPrompt).stream((message: Message) => {
      if (message.type === 'assistant') {
        for (const block of message.content) {
          if (block.type === 'text') {
            full += block.text;
            opts.onChunk!(block.text);
          }
        }
      }
    });
    return full;
  }

  return builder.query(fullPrompt).asText();
}

// Wraps a Response-Parser stream into the IStreamSink contract.
export async function streamToSink(
  prompt: string,
  sink: IStreamSink,
  model = 'claude-sonnet-4-6-20250514',
): Promise<void> {
  try {
    await claude()
      .withModel(model)
      .allowTools()
      .query(prompt)
      .stream(async (message: Message) => {
        if (message.type === 'assistant') {
          for (const block of message.content) {
            if (block.type === 'text') {
              await sink.onAssistantText(block.text);
            } else if (block.type === 'tool_use') {
              await sink.onToolUse(block.name, block.input);
            }
          }
        }
      });
    await sink.onDone();
  } catch (err) {
    await sink.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
