<svelte:head>
  <title>Performance · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';
  import { amountPrivacy } from '$lib/privacy/amount-privacy-store';
  import { formatMaskedMoney } from '$lib/privacy/format-amount';
  import { formatUnitRateAsPercent2 } from '$lib/formatting/percent-display';

  type TwrRow = {
    readonly periodDate: string;
    readonly cumulativeTwrReturn: string;
    readonly subperiodReturn: string;
    readonly valuationEndAmount: string;
    readonly calculationMethod: string;
  };

  type TwrRange = 'ALL' | '1M' | '3M' | 'YTD' | '1Y';

  let rows: readonly TwrRow[] = [];
  let isLoading: boolean = true;
  let range: TwrRange = 'ALL';
  let baseCurrencyCode: string = 'USD';

  $: masked = $amountPrivacy;

  async function load(): Promise<void> {
    isLoading = true;
    try {
      const [pf, response] = await Promise.all([
        apiClient.executeJson<{ readonly baseCurrencyCode: string }>({ method: 'GET', path: '/portfolio' }),
        apiClient.executeJson<{ readonly items: readonly TwrRow[] }>({
          method: 'GET',
          path: '/performance/twr',
          query: range === 'ALL' ? undefined : { range },
        }),
      ]);
      baseCurrencyCode = pf.baseCurrencyCode;
      rows = response.items;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load TWR');
      rows = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void load();
  });

</script>

<section class="space-y-3">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Performance</h1>
    <p class="text-sm text-gray-600 dark:text-muted-foreground">
      Daily TWR (TWR_DAILY_V1) from portfolio snapshots. Run <strong>Rebuild snapshots</strong> on the Prices page after
      ledger or price changes. Presets use UTC calendar dates (same as snapshot rows).
    </p>
  </header>

  <div class="flex flex-wrap items-center gap-3">
    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground">
      <span class="text-gray-600 dark:text-muted-foreground">Range</span>
      <select
        class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-border dark:bg-card dark:text-foreground"
        bind:value={range}
        on:change={() => void load()}
      >
        <option value="ALL">All</option>
        <option value="1M">1 month</option>
        <option value="3M">3 months</option>
        <option value="YTD">Year to date</option>
        <option value="1Y">1 year</option>
      </select>
    </label>
    <button
      type="button"
      class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent"
      disabled={isLoading}
      on:click={() => void load()}
    >
      {isLoading ? 'Loading…' : 'Reload'}
    </button>
  </div>

  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if rows.length === 0}
    <div
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-border dark:bg-muted/30"
    >
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        No performance rows yet. Add transactions and prices, then rebuild snapshots.
      </p>
    </div>
  {:else}
    <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/40">
          <tr>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Date</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Day</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Cumulative TWR</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Portfolio value</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Method</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.periodDate)}
            <tr class="border-b border-gray-100 dark:border-border">
              <td class="px-3 py-2 text-gray-800 dark:text-foreground">{row.periodDate}</td>
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">{formatUnitRateAsPercent2(row.subperiodReturn)}</td>
              <td class="px-3 py-2 text-gray-800 dark:text-foreground">{formatUnitRateAsPercent2(row.cumulativeTwrReturn)}</td>
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                {formatMaskedMoney({ masked, decimalString: row.valuationEndAmount, currencyCode: baseCurrencyCode })}
              </td>
              <td class="px-3 py-2 text-gray-600 dark:text-muted-foreground">{row.calculationMethod}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
