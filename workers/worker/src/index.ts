/**
 * Badgers Investments worker entry.
 * Processes queued recommendation runs (same Dynamo + env as the API).
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

async function main(): Promise<void> {
  const workerPackageDir: string = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
  const repoRoot: string = path.resolve(workerPackageDir, '..', '..');
  execSync('pnpm --filter api recommendation-queue:process', { stdio: 'inherit', cwd: repoRoot });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
