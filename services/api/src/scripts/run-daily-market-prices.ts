import { executeDailyMarketPriceJob } from '../jobs/daily-market-prices.js';

async function main(): Promise<void> {
  const result = await executeDailyMarketPriceJob({ now: new Date() });
  console.log(
    JSON.stringify({
      usersProcessed: result.usersProcessed,
      snapshotsWritten: result.snapshotsWritten,
      userIdsConfigured: result.userIdsConfigured,
      userIdSource: result.userIdSource,
      errors: result.errors,
    }),
  );
  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
