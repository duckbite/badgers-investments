import type { EventBridgeEvent, Context } from 'aws-lambda';

type ScheduledEvent = EventBridgeEvent<'Scheduled Event', unknown>;

export async function handler(event: ScheduledEvent, context: Context): Promise<{ ok: boolean }> {
  void event;
  void context;
  console.log('Daily worker scheduled invocation (placeholder).');
  return { ok: true };
}
