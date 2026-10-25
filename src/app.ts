import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { allowedOrigins, env } from './config/env';
import { errorHandler, notFoundHandler } from './common/errors/error-handler';
import { openApiDocument } from './docs/openapi';
import { AppError } from './common/errors/app-error';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import clientsRoutes from './modules/clients/clients.routes';
import projectsRoutes from './modules/projects/projects.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import healthRoutes from './modules/health/health.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.locals.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);
    next();
  });
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed by CORS.'));
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/clients', clientsRoutes);
  app.use('/api/v1/projects', projectsRoutes);
  app.use('/api/v1', tasksRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const applicationConfig = { port: env.PORT, environment: env.NODE_ENV };
