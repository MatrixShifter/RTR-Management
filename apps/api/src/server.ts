import { app } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(config.PORT, HOST, () => {
  logger.info(`RTR Wholesale Management API is listening and ready on port ${config.PORT}`, {
    host: HOST,
    port: config.PORT,
    environment: config.NODE_ENV,
    corsOrigin: config.CORS_ORIGIN,
    endpoints: {
      local: `http://localhost:${config.PORT}`,
      loopback: `http://127.0.0.1:${config.PORT}`,
      health: `http://127.0.0.1:${config.PORT}/api/health`
    }
  });
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${config.PORT} is already in use by another process. Please terminate the process using port ${config.PORT} or configure PORT in your environment.`);
  } else {
    logger.error('API server fatal startup error:', { message: err?.message, code: err?.code });
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise Rejection detected in API server:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: config.NODE_ENV !== 'production' && reason instanceof Error ? reason.stack : undefined
  });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception detected in API server:', {
    message: err.message,
    stack: config.NODE_ENV !== 'production' ? err.stack : undefined
  });
  process.exit(1);
});

let isShuttingDown = false;
const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received. Shutting down RTR API server gracefully (draining active connections)...`);

  const forceKillTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);
  if (forceKillTimer.unref) forceKillTimer.unref();

  server.close(() => {
    clearTimeout(forceKillTimer);
    logger.info('All RTR API server connections drained and closed cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
