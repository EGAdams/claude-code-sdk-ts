import type { Response } from 'express';
import type { IStreamSink } from '../interfaces/claude.js';

export function createSSESink(res: Response, taskId: string): IStreamSink {
  return {
    onAssistantText(text: string): void {
      const event = JSON.stringify({ type: 'chunk', taskId, content: text });
      res.write(`data: ${event}\n\n`);
    },

    onToolUse(toolName: string, input: unknown): void {
      const event = JSON.stringify({ type: 'tool_use', taskId, tool: toolName, input });
      res.write(`data: ${event}\n\n`);
    },

    onDone(): void {
      const event = JSON.stringify({ type: 'done', taskId, status: 'COMPLETED' });
      res.write(`data: ${event}\n\n`);
      res.end();
    },

    onError(err: Error): void {
      const event = JSON.stringify({ type: 'error', taskId, error: err.message });
      res.write(`data: ${event}\n\n`);
      res.end();
    },
  };
}

export function initSSEResponse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}
