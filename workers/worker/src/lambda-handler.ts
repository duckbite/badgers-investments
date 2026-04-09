import type { EventBridgeEvent, Context } from 'aws-lambda';

type ScheduledEvent = EventBridgeEvent<'Scheduled Event', unknown>;

export async function handler(event: ScheduledEvent, context: Context): Promise<{ ok: boolean }> {
  void event;
  void context;
  console.log('Worker scheduled invocation (placeholder).');
  return { ok: true };
}
