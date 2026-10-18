import { app } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const server = app.listen(config.PORT, () => {
  logger.info(`Crimpston Accessories API listening on port ${config.PORT}`, {
    environment: config.NODE_ENV,
    corsOrigin: config.CORS_ORIGIN
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('API server closed successfully.');
    process.exit(0);
  });
});
