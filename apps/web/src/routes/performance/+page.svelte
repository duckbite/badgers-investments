<svelte:head>
  <title>Performance · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { Calendar, DollarSign, Percent, TrendingUp } from 'lucide-svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import AreaChartPanel from '$lib/components/AreaChartPanel.svelte';
  import BarChartPanel from '$lib/components/BarChartPanel.svelte';
  import { readChartThemePalette } from '$lib/charts/chart-theme';
  import { amountPrivacy } from '$lib/privacy/amount-privacy-store';
  import { formatMaskedMoney } from '$lib/privacy/format-amount';
  import { formatUnitRateAsPercent2 } from '$lib/formatting/percent-display';
  import { toast } from '$lib/toast/toast';

  type TwrRow = {
    readonly periodDate: string;
    readonly cumulativeTwrReturn: string;
    readonly subperiodReturn: string;
    readonly valuationEndAmount: string;
    readonly valuationStartAmount: string;
    readonly externalCashFlowsAmount: string;
    readonly calculationMethod: string;
  };

  type TwrRange = 'ALL' | '1M' | '3M' | 'YTD' | '1Y';

  let rows: readonly TwrRow[] = [];
  let isLoading: boolean = true;
  let range: TwrRange = 'ALL';
  let baseCurrencyCode: string = 'USD';
  let twrBarColor: string = '#059669';
  let depositColor: string = '#10b981';
  let withdrawalColor: string = '#ef4444';

  $: masked = $amountPrivacy;

  $: chartLabels = rows.map((r) => r.periodDate);
  $: portfolioValues = rows.map((r) => Number.parseFloat(r.valuationEndAmount));
  $: twrBarPercents = rows.map((r) => {
    const u: number = Number.parseFloat(r.subperiodReturn);
    return Number.isFinite(u) ? u * 100 : 0;
  });
  $: depositsSeries = rows.map((r) => {
    const x: number = Number.parseFloat(r.externalCashFlowsAmount);
    return Number.isFinite(x) && x > 0 ? x : 0;
  });
  $: withdrawalsSeries = rows.map((r) => {
    const x: number = Number.parseFloat(r.externalCashFlowsAmount);
    return Number.isFinite(x) && x < 0 ? -x : 0;
  });

  $: twrDataset = [
    {
      label: 'TWR %',
      data: twrBarPercents,
      backgroundColor: twrBarColor,
    },
  ];

  $: cashFlowDatasets = [
    { label: 'Deposits (net inflow)', data: depositsSeries, backgroundColor: depositColor },
    { label: 'Withdrawals (net outflow)', data: withdrawalsSeries, backgroundColor: withdrawalColor },
  ];

  $: latestRow = rows.length > 0 ? rows[rows.length - 1] : undefined;
  $: firstRow = rows.length > 0 ? rows[0] : undefined;

  $: currentTwrPct =
    latestRow !== undefined ? Number.parseFloat(latestRow.subperiodReturn) * 100 : Number.NaN;
  $: avgTwrPct =
    rows.length > 0
      ? (rows.reduce((s, r) => s + Number.parseFloat(r.subperiodReturn), 0) / rows.length) * 100
      : Number.NaN;
  $: totalReturnMoney =
    latestRow !== undefined && firstRow !== undefined
      ? Number.parseFloat(latestRow.valuationEndAmount) - Number.parseFloat(firstRow.valuationStartAmount)
      : Number.NaN;
  $: netContributions =
    rows.length > 0 ? rows.reduce((s, r) => s + Number.parseFloat(r.externalCashFlowsAmount), 0) : Number.NaN;

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
      const t = readChartThemePalette();
      twrBarColor = t.primary;
      depositColor = t.chartColors[1] ?? '#10b981';
      withdrawalColor = t.destructive;
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

<section class="space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Performance Analytics</h1>
    <p class="text-sm text-gray-600 dark:text-muted-foreground">
      Time-weighted returns and portfolio metrics from daily snapshots (TWR_DAILY_V1). Cash-flow bars split signed
      <code class="rounded bg-gray-100 px-1 text-xs dark:bg-muted">externalCashFlowsAmount</code> per row (often zero until flows are modelled explicitly).
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
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
          <Percent class="h-4 w-4" aria-hidden="true" />
          Current TWR
        </div>
        <div class="mt-2 text-3xl font-bold text-gray-900 dark:text-foreground">
          {Number.isFinite(currentTwrPct) ? `${currentTwrPct.toFixed(2)}%` : '—'}
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">Latest period (daily)</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
          <TrendingUp class="h-4 w-4" aria-hidden="true" />
          Average TWR
        </div>
        <div class="mt-2 text-3xl font-bold text-gray-900 dark:text-foreground">
          {Number.isFinite(avgTwrPct) ? `${avgTwrPct.toFixed(2)}%` : '—'}
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">Mean of daily sub-period returns</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
          <DollarSign class="h-4 w-4" aria-hidden="true" />
          Total Return
        </div>
        <div class="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
          {Number.isFinite(totalReturnMoney)
            ? formatMaskedMoney({
                masked,
                decimalString: String(totalReturnMoney),
                currencyCode: baseCurrencyCode,
              })
            : '—'}
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">End value minus start basis (range)</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
          <Calendar class="h-4 w-4" aria-hidden="true" />
          Net Contributions
        </div>
        <div class="mt-2 text-3xl font-bold text-gray-900 dark:text-foreground">
          {Number.isFinite(netContributions)
            ? formatMaskedMoney({
                masked,
                decimalString: String(netContributions),
                currencyCode: baseCurrencyCode,
              })
            : '—'}
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">Sum of external cash-flow amounts</p>
      </div>
    </div>

    {#if masked}
      <div
        class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 text-sm text-gray-600 dark:border-border dark:bg-muted/30 dark:text-muted-foreground"
      >
        Charts are hidden while amounts are anonymized. Unlock amounts from the header to see performance charts.
      </div>
    {:else}
      <AreaChartPanel
        title="Portfolio Value Over Time"
        description="End-of-period valuation from the TWR snapshot chain"
        labels={chartLabels}
        values={portfolioValues}
        datasetLabel="Portfolio Value"
        currencyCode={baseCurrencyCode}
        emptyMessage="No valuation series."
        chartHeightClass="h-96"
      />

      <BarChartPanel
        title="Time-Weighted Return (TWR)"
        description="Daily sub-period return (shown as percent)"
        labels={chartLabels}
        datasets={twrDataset}
        yTickPercent={true}
        emptyMessage="No TWR rows."
      />

      <BarChartPanel
        title="Cash Flow Analysis"
        description="Positive vs negative external flows per period (from snapshot rows)"
        labels={chartLabels}
        datasets={cashFlowDatasets}
        yTickCurrency={baseCurrencyCode}
        stacked={false}
        emptyMessage="No cash-flow data."
      />
    {/if}

    <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
      <h2 class="text-base font-semibold text-gray-900 dark:text-foreground">Period-by-Period Performance</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Daily rows for the selected range</p>
      <div class="mt-4 space-y-3">
        {#each rows as row, index (row.periodDate)}
          {@const prevEnd =
            index > 0 ? Number.parseFloat(rows[index - 1].valuationEndAmount) : Number.parseFloat(row.valuationStartAmount)}
          {@const curEnd = Number.parseFloat(row.valuationEndAmount)}
          {@const delta = Number.isFinite(prevEnd) && Number.isFinite(curEnd) ? curEnd - prevEnd : Number.NaN}
          <div
            class="flex flex-col gap-3 rounded-lg bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-muted/40"
          >
            <div class="flex flex-wrap items-center gap-4">
              <div class="w-28 font-medium text-gray-900 dark:text-foreground">{row.periodDate}</div>
              <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-600 dark:text-muted-foreground">TWR:</span>
                <span class="font-medium text-gray-900 dark:text-foreground">{formatUnitRateAsPercent2(row.subperiodReturn)}</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-6 sm:justify-end">
              <div class="text-right">
                <p class="text-sm text-gray-600 dark:text-muted-foreground">Value</p>
                <p class="font-medium text-gray-900 dark:text-foreground">
                  {formatMaskedMoney({ masked, decimalString: row.valuationEndAmount, currencyCode: baseCurrencyCode })}
                </p>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600 dark:text-muted-foreground">Change vs prev</p>
                <p class={`font-medium ${Number.isFinite(delta) && delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {#if Number.isFinite(delta)}
                    {delta >= 0 ? '+' : ''}{formatMaskedMoney({ masked, decimalString: String(delta), currencyCode: baseCurrencyCode })}
                  {:else}
                    —
                  {/if}
                </p>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600 dark:text-muted-foreground">External CF</p>
                <p class="font-medium text-gray-900 dark:text-foreground">
                  {formatMaskedMoney({ masked, decimalString: row.externalCashFlowsAmount, currencyCode: baseCurrencyCode })}
                </p>
              </div>
              <div class="hidden text-right text-xs text-gray-500 md:block dark:text-muted-foreground">
                {row.calculationMethod}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>
