<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';

  export let open: boolean = false;

  const dispatch = createEventDispatcher<{ success: void; cancel: void }>();

  let pinValue: string = '';
  let error: string = '';
  let submitting: boolean = false;

  function reset(): void {
    pinValue = '';
    error = '';
    submitting = false;
  }

  $: if (!open) {
    reset();
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const trimmed: string = pinValue.trim();
    if (trimmed.length === 0) {
      error = 'Enter your PIN.';
      return;
    }
    submitting = true;
    error = '';
    try {
      const r = await apiClient.executeJson<{ readonly ok: boolean }, { readonly pin: string }>({
        method: 'POST',
        path: '/settings/privacy/verify-amount-reveal-pin',
        body: { pin: trimmed },
      });
      if (r.ok) {
        reset();
        dispatch('success');
        return;
      }
      error = 'Incorrect PIN. Please try again.';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not verify PIN.';
    } finally {
      submitting = false;
    }
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
        Enter the amount-reveal PIN you saved under <strong>Settings → Security</strong>. It is verified on the server.
      </p>
      <form class="mt-4 space-y-3" on:submit={(e) => void handleSubmit(e)}>
        <input
          type="password"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="64"
          class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-background dark:text-foreground"
          placeholder="PIN"
          bind:value={pinValue}
          disabled={submitting}
        />
        {#if error.length > 0}
          <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
        {/if}
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent"
            disabled={submitting}
            on:click={handleCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
