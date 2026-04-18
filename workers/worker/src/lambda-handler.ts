import type { EventBridgeEvent, Context } from 'aws-lambda';
import { executeDailyMarketPriceJob } from 'api/jobs/daily-market-prices';

type ScheduledEvent = EventBridgeEvent<'Scheduled Event', unknown>;

export async function handler(event: ScheduledEvent, context: Context): Promise<{ ok: boolean; result?: unknown }> {
  void event;
  void context;
  const result = await executeDailyMarketPriceJob({ now: new Date() });
  console.log(JSON.stringify(result));
  return { ok: result.errors.length === 0, result };
}
