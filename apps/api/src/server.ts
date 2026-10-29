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

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down RTR API server gracefully...`);
  server.close(() => {
    logger.info('RTR API server closed successfully.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
