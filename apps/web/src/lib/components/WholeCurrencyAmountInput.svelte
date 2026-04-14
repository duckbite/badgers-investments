<script lang="ts">
  import { ALLOWED_CURRENCY_CODES } from '$lib/domain/allowed-currency-codes';

  export let currencyCode: string = 'USD';
  /** Whole major units only (no decimals). `null` means cleared / not set. */
  export let amountWhole: number | null = null;

  const locale: string = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

  function formatWhole(n: number): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: true }).format(n);
  }

  $: display = amountWhole === null || amountWhole <= 0 ? '' : formatWhole(amountWhole);

  function handleInput(event: Event): void {
    const el = event.currentTarget as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    if (digits.length === 0) {
      amountWhole = null;
      return;
    }
    let parsed = Number.parseInt(digits, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    if (parsed > Number.MAX_SAFE_INTEGER) {
      parsed = Number.MAX_SAFE_INTEGER;
    }
    amountWhole = parsed;
  }
</script>

<div class="flex gap-2">
  <select
    class="w-28 shrink-0 rounded-lg border border-gray-300 px-2 py-2.5 text-sm dark:border-border dark:bg-background"
    bind:value={currencyCode}
    aria-label="Currency for monthly investable amount"
  >
    {#each ALLOWED_CURRENCY_CODES as code (code)}
      <option value={code}>{code}</option>
    {/each}
  </select>
  <input
    class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm tabular-nums dark:border-border dark:bg-background"
    inputmode="numeric"
    autocomplete="off"
    placeholder="0"
    value={display}
    on:input={handleInput}
  />
</div>
