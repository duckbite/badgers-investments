<svelte:head>
  <title>Performance · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';

  type TwrRow = {
    readonly periodDate: string;
    readonly cumulativeTwrReturn: string;
    readonly subperiodReturn: string;
    readonly valuationEndAmount: string;
    readonly calculationMethod: string;
  };

  let rows: readonly TwrRow[] = [];
  let isLoading: boolean = true;

  async function load(): Promise<void> {
    isLoading = true;
    try {
      const response = await apiClient.executeJson<{ readonly items: readonly TwrRow[] }>({
        method: 'GET',
        path: '/performance/twr',
      });
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

  function formatPct(raw: string): string {
    const n: number = Number.parseFloat(raw);
    if (!Number.isFinite(n)) {
      return raw;
    }
    return `${(n * 100).toFixed(2)}%`;
  }
</script>

<section class="space-y-3">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Performance</h1>
    <p class="text-sm text-gray-600 dark:text-muted-foreground">
      Daily TWR (TWR_DAILY_V1) from portfolio snapshots. Run <strong>Rebuild snapshots</strong> on the Prices page after
      ledger or price changes.
    </p>
  </header>

  <div class="flex gap-2">
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
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">{formatPct(row.subperiodReturn)}</td>
              <td class="px-3 py-2 text-gray-800 dark:text-foreground">{formatPct(row.cumulativeTwrReturn)}</td>
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">{row.valuationEndAmount}</td>
              <td class="px-3 py-2 text-gray-600 dark:text-muted-foreground">{row.calculationMethod}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
