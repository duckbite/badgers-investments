/**
 * Badgers Investments worker entry.
 * Scheduled/heavy jobs (e.g. snapshot rebuilds) will be invoked from here.
 */
async function main(): Promise<void> {
  console.log('Worker started (no jobs configured yet).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
