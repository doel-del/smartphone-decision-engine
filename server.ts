import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter } from './src/server/routes.js';
import { initializePipeline, Pipeline } from './src/server/pipeline.js';
import { logger } from './src/server/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const isProduction = process.env.NODE_ENV === 'production';

  logger.info('server_starting', { port, env: process.env.NODE_ENV ?? 'development' });

  app.use(express.json({ limit: '100kb' }));

  // ─── Liveness probe ───
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // ─── Initialize pipeline ───
  let pipeline: Pipeline | null = null;
  try {
    pipeline = initializePipeline();
  } catch (err: any) {
    logger.error('pipeline_initialization_fatal', {
      message: err.message,
      stack: err.stack,
    });
  }

  // ─── Readiness probe ───
  app.get('/ready', (_req, res) => {
    if (!pipeline || !pipeline.health.ok) {
      return res.status(503).json({
        status: 'not_ready',
        issues: pipeline?.health.issues ?? ['Pipeline gagal diinisialisasi'],
      });
    }
    res.json({
      status: 'ready',
      initializedAt: pipeline.initializedAt,
      durationMs: pipeline.durationMs,
    });
  });

  // ─── API ───
  if (pipeline) {
    app.use('/api', createApiRouter(pipeline));
  } else {
    app.use('/api', (_req, res) => {
      res.status(503).json({
        error: 'PIPELINE_UNAVAILABLE',
        message: 'Evidence pipeline gagal diinisialisasi. Server tidak dapat melayani keputusan.',
      });
    });
  }

  // ─── API 404 (before SPA fallback) ───
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint API tidak ditemukan.' });
  });

  // ─── Frontend ───
  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // ─── Global error handler ───
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('unhandled_error', {
      path: req.path,
      method: req.method,
      message: err.message,
      stack: err.stack,
    });
    if (res.headersSent) return;
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: isProduction ? 'Internal server error' : err.message,
    });
  });

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info('server_listening', {
      port,
      health: pipeline?.health.ok ?? false,
      issues: pipeline?.health.issues ?? [],
    });
  });

  // ─── Graceful shutdown ───
  const shutdown = (signal: string) => {
    logger.info('shutdown_signal', { signal });
    server.close(() => {
      logger.info('server_closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('shutdown_timeout_forced');
      process.exit(1);
    }, 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error('server_start_failed', { message: err.message, stack: err.stack });
  process.exit(1);
});