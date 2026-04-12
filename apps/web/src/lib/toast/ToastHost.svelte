<script lang="ts">
  import { dismissToast, toasts } from './toast';
  import { CheckCircle2, X, XCircle } from 'lucide-svelte';
</script>

<div
  class="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[min(24rem,calc(100vw-2rem))] max-w-sm flex-col gap-2 font-sans"
  aria-live="polite"
>
  {#each $toasts as item (item.id)}
    <div
      class="pointer-events-auto animate-in fade-in slide-in-from-right-2 flex rounded-lg border bg-card p-3 text-card-foreground shadow-lg duration-200 {item.variant === 'error'
        ? 'border-destructive/30'
        : 'border-emerald-200 dark:border-emerald-800'}"
      role="status"
    >
      <div class="flex flex-1 items-start gap-2.5">
        {#if item.variant === 'error'}
          <XCircle class="mt-0.5 h-[18px] w-[18px] shrink-0 text-destructive" aria-hidden="true" />
        {:else}
          <CheckCircle2 class="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        {/if}
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-snug">{item.title}</p>
          {#if item.description !== undefined && item.description.length > 0}
            <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
          {/if}
        </div>
        <button
          type="button"
          class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Dismiss notification"
          on:click={() => dismissToast(item.id)}
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>
  {/each}
</div>
