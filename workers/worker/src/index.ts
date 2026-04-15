/**
 * Badgers Investments daily worker entry.
 * Reserved for scheduled maintenance jobs.
 */

async function main(): Promise<void> {
  console.log('Daily worker started. No scheduled jobs are configured yet.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
