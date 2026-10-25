import { createApp, applicationConfig } from './app';
import { prisma } from './config/prisma';

const app = createApp();
const server = app.listen(applicationConfig.port, () => {
  console.info(
    `DevFlow API listening on port ${applicationConfig.port} (${applicationConfig.environment}).`,
  );
});

async function shutdown(signal: string): Promise<void> {
  console.info(`${signal} received; shutting down gracefully.`);
  server.close(async (error) => {
    if (error) {
      console.error('HTTP server shutdown failed.', error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
