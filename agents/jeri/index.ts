import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { buildContainer } from './container.js';
import { createA2AServer } from './a2a/server.js';

const PORT = parseInt(process.env['JERI_A2A_PORT'] ?? '9001', 10);
const PID_FILE = path.join('logs', 'jeri_agent.pid');
const LOG_PREFIX = '[Jeri]';

async function ensureLogsDir(): Promise<void> {
  await fs.mkdir('logs', { recursive: true });
}

async function writePid(): Promise<void> {
  await ensureLogsDir();
  await fs.writeFile(PID_FILE, String(process.pid), 'utf-8');
}

async function removePid(): Promise<void> {
  try {
    await fs.unlink(PID_FILE);
  } catch {
    // ignore if already gone
  }
}

async function main(): Promise<void> {
  await writePid();
  console.log(`${LOG_PREFIX} PID ${process.pid} written to ${PID_FILE}`);

  const { registry, messenger } = buildContainer();

  // Log registered capabilities
  const caps = registry.list().map(c => c.name).join(', ');
  console.log(`${LOG_PREFIX} Capabilities: ${caps}`);

  // Connect stub messenger (no-op for now)
  await messenger.connect();

  // Start A2A HTTP server
  const app = createA2AServer(registry);
  const server = app.listen(PORT, () => {
    console.log(`${LOG_PREFIX} A2A server listening on port ${PORT}`);
    console.log(`${LOG_PREFIX} AgentCard: http://localhost:${PORT}/.well-known/agent.json`);
    console.log(`${LOG_PREFIX} Health:    http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (reason: string) => {
    console.log(`${LOG_PREFIX} Shutting down (${reason})...`);
    await messenger.close();
    server.close(async () => {
      await removePid();
      console.log(`${LOG_PREFIX} Stopped.`);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch(err => {
  console.error(`${LOG_PREFIX} Fatal:`, err);
  process.exit(1);
});
