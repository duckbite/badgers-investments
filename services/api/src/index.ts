import { createServer } from './server/create-server.js';
import { startServer } from './server/start-server.js';

async function main(): Promise<void> {
  const app = await createServer();
  await startServer({ app });
}

main().catch((err: unknown) => {
  const error: Error = err instanceof Error ? err : new Error('Unknown error');
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
