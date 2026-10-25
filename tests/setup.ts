process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
const configuredDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.DATABASE_URL = configuredDatabaseUrl?.includes('devflow_test')
  ? configuredDatabaseUrl
  : 'postgresql://devflow:devflow_test_only@localhost:5432/devflow_test?schema=public';
process.env.JWT_SECRET ??= 'test-only-secret-key-with-at-least-thirty-two-characters';
process.env.JWT_EXPIRES_IN_SECONDS ??= '900';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.RATE_LIMIT_WINDOW_MS ??= '900000';
process.env.RATE_LIMIT_MAX ??= '10';
