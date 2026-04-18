/**
 * Optional override: comma-separated DynamoDB `userId` values for the daily market-price job.
 * When unset or empty, the job discovers **all active** users via `UserAccountRepository.listAllActiveUserIds()` (table scan).
 */
export function getMarketPriceUserIdsFromEnv(): readonly string[] {
  const raw: string | undefined = process.env['BADGERS_MARKET_PRICE_USER_IDS']?.trim();
  if (raw === undefined || raw.length === 0) {
    return [];
  }
  const parts: string[] = raw.split(',');
  const ids: string[] = [];
  for (const part of parts) {
    const trimmed: string = part.trim();
    if (trimmed.length > 0) {
      ids.push(trimmed);
    }
  }
  return ids;
}
