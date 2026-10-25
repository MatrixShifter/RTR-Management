import { app } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const server = app.listen(config.PORT, '0.0.0.0', () => {
  logger.info(`RTR Wholesale Management API listening on port ${config.PORT}`, {
    environment: config.NODE_ENV,
    corsOrigin: config.CORS_ORIGIN
  });
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${config.PORT} is already in use by another process. Please terminate the process using port ${config.PORT} or configure PORT in your environment.`);
  } else {
    logger.error('API server fatal error:', { message: err?.message });
  }
  process.exit(1);
});

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('API server closed successfully.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
