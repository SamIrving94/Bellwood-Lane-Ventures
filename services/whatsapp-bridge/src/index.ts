import { createBridge } from './bridge.js';
import { log } from './logger.js';

async function main() {
  log.info('starting Bellwood WhatsApp bridge...');
  const client = createBridge();

  const shutdown = async (signal: string) => {
    log.info(`received ${signal}, shutting down...`);
    try {
      await client.destroy();
    } catch (err) {
      log.error('error during shutdown:', err);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await client.initialize();
  } catch (err) {
    log.error('failed to initialize:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
