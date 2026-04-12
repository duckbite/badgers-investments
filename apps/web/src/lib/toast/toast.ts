import { writable } from 'svelte/store';

export type ToastVariant = 'error' | 'success';

export type ToastItem = {
  readonly id: string;
  readonly variant: ToastVariant;
  readonly title: string;
  readonly description?: string;
};

const internal = writable<readonly ToastItem[]>([]);

export const toasts = { subscribe: internal.subscribe };

export function dismissToast(id: string): void {
  internal.update((list) => list.filter((item) => item.id !== id));
}

export function pushToast(input: {
  readonly variant: ToastVariant;
  readonly title: string;
  readonly description?: string;
  readonly durationMs?: number;
}): string {
  const id: string = crypto.randomUUID();
  const durationMs: number = input.durationMs ?? 4000;
  const item: ToastItem = {
    id,
    variant: input.variant,
    title: input.title,
    description: input.description,
  };
  internal.update((list) => [...list, item]);
  if (durationMs > 0) {
    window.setTimeout((): void => dismissToast(id), durationMs);
  }
  return id;
}

export const toast = {
  error(title: string, options?: Readonly<{ readonly description?: string; readonly durationMs?: number }>): string {
    return pushToast({
      variant: 'error',
      title,
      description: options?.description,
      durationMs: options?.durationMs,
    });
  },
  success(title: string, options?: Readonly<{ readonly description?: string; readonly durationMs?: number }>): string {
    return pushToast({
      variant: 'success',
      title,
      description: options?.description,
      durationMs: options?.durationMs,
    });
  },
};
