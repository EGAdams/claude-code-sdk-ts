import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AGENT_CARD } from './agent-card.js';
import { createSSESink, initSSEResponse } from './streaming.js';
import type { ICapabilityRegistry } from '../interfaces/capabilities.js';
import type { ITaskRequest } from '../interfaces/capabilities.js';

type TaskState = 'SUBMITTED' | 'WORKING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

interface TaskRecord {
  state: TaskState;
  result?: string;
  error?: string;
  createdAt: Date;
}

const tasks = new Map<string, TaskRecord>();

function makeCancellationToken() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel(reason?: string) {
      controller.abort(reason);
    },
    isCancelled() {
      return controller.signal.aborted;
    },
  };
}

function buildTaskRequest(
  capability: string,
  messageText: string,
  context: Record<string, unknown>,
  correlationId: string,
): ITaskRequest {
  return {
    capability,
    description: messageText,
    context,
    correlationId,
    cancellation: makeCancellationToken(),
  };
}

export function createA2AServer(registry: ICapabilityRegistry): express.Application {
  const app = express();
  app.use(express.json());

  // AgentCard discovery
  app.get('/.well-known/agent.json', (_req, res) => {
    res.json(AGENT_CARD);
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, skills: registry.list().map(c => c.name) });
  });

  // JSON-RPC 2.0 endpoint
  app.post('/', async (req, res) => {
    const { method, params, id } = req.body as {
      method: string;
      params: Record<string, unknown>;
      id: string | number;
    };

    const jsonRpcError = (code: number, message: string) =>
      res.json({ jsonrpc: '2.0', id, error: { code, message } });

    switch (method) {
      case 'SendMessage': {
        const taskId = uuidv4();
        tasks.set(taskId, { state: 'SUBMITTED', createdAt: new Date() });

        const msgParts = (params['message'] as { parts?: { text?: string }[] })?.parts ?? [];
        const text = msgParts.map(p => p.text ?? '').join(' ').trim() || (params['description'] as string ?? '');
        const skillId = (params['skill'] as string) ?? 'analyze_statement';
        const context = (params['context'] as Record<string, unknown>) ?? {};

        const capability = registry.resolve(skillId);
        if (!capability) {
          tasks.set(taskId, { state: 'FAILED', error: `Unknown skill: ${skillId}`, createdAt: new Date() });
          return jsonRpcError(-32601, `Skill not found: ${skillId}`);
        }

        tasks.set(taskId, { state: 'WORKING', createdAt: new Date() });

        const request = buildTaskRequest(skillId, text, context, taskId);
        capability.execute(request).then(response => {
          tasks.set(taskId, {
            state: response.status === 'ok' ? 'COMPLETED' : 'FAILED',
            result: response.message,
            error: response.status === 'error' ? response.message : undefined,
            createdAt: new Date(),
          });
        }).catch(err => {
          tasks.set(taskId, {
            state: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
            createdAt: new Date(),
          });
        });

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            id: taskId,
            status: { state: 'SUBMITTED' },
          },
        });
      }

      case 'SendStreamingMessage': {
        const taskId = uuidv4();
        tasks.set(taskId, { state: 'SUBMITTED', createdAt: new Date() });

        const msgParts = (params['message'] as { parts?: { text?: string }[] })?.parts ?? [];
        const text = msgParts.map(p => p.text ?? '').join(' ').trim() || (params['description'] as string ?? '');
        const skillId = (params['skill'] as string) ?? 'analyze_statement';
        const context = (params['context'] as Record<string, unknown>) ?? {};

        const capability = registry.resolve(skillId);
        if (!capability) {
          tasks.set(taskId, { state: 'FAILED', error: `Unknown skill: ${skillId}`, createdAt: new Date() });
          return jsonRpcError(-32601, `Skill not found: ${skillId}`);
        }

        initSSEResponse(res);
        tasks.set(taskId, { state: 'WORKING', createdAt: new Date() });

        const request = buildTaskRequest(skillId, text, context, taskId);
        const sink = createSSESink(res, taskId);

        capability.execute(request).then(response => {
          tasks.set(taskId, {
            state: response.status === 'ok' ? 'COMPLETED' : 'FAILED',
            result: response.message,
            createdAt: new Date(),
          });
          if (!res.writableEnded) {
            sink.onAssistantText(response.message);
            sink.onDone();
          }
        }).catch(err => {
          const msg = err instanceof Error ? err.message : String(err);
          tasks.set(taskId, { state: 'FAILED', error: msg, createdAt: new Date() });
          if (!res.writableEnded) {
            sink.onError(err instanceof Error ? err : new Error(msg));
          }
        });

        return;
      }

      case 'GetTask': {
        const taskId = params['id'] as string;
        const task = tasks.get(taskId);
        if (!task) return jsonRpcError(-32602, `Task not found: ${taskId}`);

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            id: taskId,
            status: { state: task.state },
            result: task.result,
            error: task.error,
          },
        });
      }

      case 'CancelTask': {
        const taskId = params['id'] as string;
        const task = tasks.get(taskId);
        if (!task) return jsonRpcError(-32602, `Task not found: ${taskId}`);

        tasks.set(taskId, { ...task, state: 'CANCELED' });
        return res.json({ jsonrpc: '2.0', id, result: { id: taskId, status: { state: 'CANCELED' } } });
      }

      case 'GetExtendedAgentCard':
        return res.json({ jsonrpc: '2.0', id, result: AGENT_CARD });

      default:
        return jsonRpcError(-32601, `Method not found: ${method}`);
    }
  });

  return app;
}
