<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open: boolean = false;
  export let expectedPin: string = '';

  const dispatch = createEventDispatcher<{ success: void; cancel: void }>();

  let pinValue: string = '';
  let error: string = '';

  function reset(): void {
    pinValue = '';
    error = '';
  }

  $: if (!open) {
    reset();
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const trimmed: string = pinValue.trim();
    if (trimmed !== expectedPin) {
      error = 'Incorrect PIN. Please try again.';
      return;
    }
    reset();
    dispatch('success');
  }

  function handleCancel(): void {
    reset();
    dispatch('cancel');
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) {
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="presentation">
    <div
      class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-border dark:bg-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-dialog-title"
    >
      <h2 id="pin-dialog-title" class="text-lg font-semibold text-gray-900 dark:text-foreground">Enter PIN</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">
        Enter your PIN to show amounts. Configure <code class="rounded bg-muted px-1 py-0.5 text-xs">PUBLIC_AMOUNT_REVEAL_PIN</code> in
        <code class="rounded bg-muted px-1 py-0.5 text-xs">.env</code> (defaults to prototype <code class="rounded bg-muted px-1 py-0.5 text-xs">1234</code>).
      </p>
      <form class="mt-4 space-y-3" on:submit={handleSubmit}>
        <input
          type="password"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="32"
          class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-background dark:text-foreground"
          placeholder="PIN"
          bind:value={pinValue}
        />
        {#if error.length > 0}
          <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
        {/if}
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent"
            on:click={handleCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Unlock
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
