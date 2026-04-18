<svelte:head>
  <title>Dashboard · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertCircle, DollarSign, TrendingDown, TrendingUp } from 'lucide-svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import {
    fetchRecommendationLatestSummary,
    getRecommendationRunDetail,
    type RecommendationItemDto,
    type RecommendationRunSummary,
  } from '$lib/api/recommendations';
  import LineChartPanel from '$lib/components/LineChartPanel.svelte';
  import PieChartPanel from '$lib/components/PieChartPanel.svelte';
  import PnlMoneyWithArrow from '$lib/components/PnlMoneyWithArrow.svelte';
  import WarningIndicator from '$lib/components/WarningIndicator.svelte';
  import { amountPrivacy } from '$lib/privacy/amount-privacy-store';
  import { formatMaskedMoney } from '$lib/privacy/format-amount';
  import { formatInstrumentDisplayLabel } from '$lib/formatting/instrument-display-label';
  import { formatNumberAsPercent2, formatPortfolioAllocationPercent } from '$lib/formatting/percent-display';
  import { toast } from '$lib/toast/toast';

  type PortfolioDto = {
    readonly portfolioId: string;
    readonly name: string;
    readonly baseCurrencyCode: string;
  };

  type AssetDto = {
    readonly assetId: string;
    readonly name: string;
    readonly symbol: string;
    readonly assetType: string;
    readonly sector: string | undefined;
    readonly isActive: boolean;
  };

  type PositionRow = {
    readonly assetId: string;
    readonly quantityHeld: string;
    readonly costBasisAmount: string;
    readonly marketPrice: string | null;
    readonly marketValueAmount: string;
    readonly unrealisedPnlAmount: string;
    readonly realisedPnlCumulativeAmount: string;
    readonly allocationPct: string | null;
  };

  type PortfolioSnap = {
    readonly snapshotDate: string;
    readonly totalMarketValueAmount: string;
    readonly totalUnrealisedPnlAmount: string;
    readonly totalRealisedPnlAmount: string;
  };

  type SnapshotStatus = {
    readonly earliestAffectedDate: string | null;
    readonly updatedAt: string | null;
  };

  type PortfolioConfigDto = {
    readonly concentrationLimits: unknown;
  };

  type TwrRow = {
    readonly periodDate: string;
    readonly valuationEndAmount: string;
  };

  type TransactionDto = {
    readonly transactionId: string;
    readonly assetId: string;
    readonly transactionType: string;
    readonly tradeDate: string;
    readonly quantity: string | undefined;
    readonly unitPrice: string | undefined;
    readonly grossAmount: string | undefined;
    readonly currencyCode: string;
    readonly isDeleted: boolean;
    readonly adjustmentSide: string | undefined;
  };

  let portfolio: PortfolioDto | undefined;
  let snapshotDate: string | null = null;
  let portfolioSnap: PortfolioSnap | null = null;
  let positions: readonly PositionRow[] = [];
  let snapshotStatus: SnapshotStatus | undefined;
  let assets: readonly AssetDto[] = [];
  let twrRows: readonly TwrRow[] = [];
  let transactions: readonly TransactionDto[] = [];
  let isLoading: boolean = true;
  let latestRec: RecommendationRunSummary | null = null;
  let priorityItems: readonly RecommendationItemDto[] = [];
  let maxSingleAssetPct: number = 100;

  $: assetById = new Map(assets.map((a) => [a.assetId, a] as const));
  $: masked = $amountPrivacy;

  $: sortedTop = [...positions]
    .map((p) => {
      const a = assetById.get(p.assetId);
      return {
        ...p,
        mv: Number.parseFloat(p.marketValueAmount),
        label: formatInstrumentDisplayLabel({
          name: a?.name ?? '',
          symbol: a?.symbol ?? '',
          fallbackId: p.assetId.slice(0, 8),
        }),
      };
    })
    .filter((p) => Number.isFinite(p.mv) && p.mv > 0)
    .sort((a, b) => b.mv - a.mv)
    .slice(0, 5);

  function readMaxSingleAssetPct(input: unknown): number {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return 100;
    }
    const raw: unknown = (input as Record<string, unknown>)['maxSingleAssetPct'];
    if (typeof raw !== 'string') {
      return 100;
    }
    const parsed: number = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return 100;
    }
    return parsed;
  }

  function exceedsMaxSingleAsset(input: { readonly allocationPct: string | null; readonly maxSingleAssetPct: number }): boolean {
    if (input.allocationPct === null) {
      return false;
    }
    const allocationPct: number = Number(input.allocationPct);
    return Number.isFinite(allocationPct) && allocationPct > input.maxSingleAssetPct;
  }

  $: assetClassAlloc = (() => {
    const map: Map<string, number> = new Map();
    for (const p of positions) {
      const mv: number = Number.parseFloat(p.marketValueAmount);
      if (!Number.isFinite(mv) || mv <= 0) {
        continue;
      }
      const at: string = assetById.get(p.assetId)?.assetType ?? 'OTHER';
      const label: string = at === 'STOCK' ? 'Stock' : at === 'ETF' ? 'ETF' : at;
      map.set(label, (map.get(label) ?? 0) + mv);
    }
    const entries: readonly [string, number][] = [...map.entries()].sort((a, b) => b[1] - a[1]);
    return entries.map(([name, v]) => ({ name, v }));
  })();

  $: assetClassPieLabels = assetClassAlloc.map((x) => x.name);
  $: assetClassPieValues = assetClassAlloc.map((x) => x.v);

  $: stocksSectorAlloc = (() => {
    const map: Map<string, number> = new Map();
    for (const p of positions) {
      const a = assetById.get(p.assetId);
      if (a?.assetType !== 'STOCK') {
        continue;
      }
      const mv: number = Number.parseFloat(p.marketValueAmount);
      if (!Number.isFinite(mv) || mv <= 0) {
        continue;
      }
      const sector: string = a.sector?.trim() || 'Unspecified';
      map.set(sector, (map.get(sector) ?? 0) + mv);
    }
    const entries: readonly [string, number][] = [...map.entries()].sort((a, b) => b[1] - a[1]);
    return entries.map(([name, v]) => ({ name, v }));
  })();

  $: sectorPieLabels = stocksSectorAlloc.map((x) => x.name);
  $: sectorPieValues = stocksSectorAlloc.map((x) => x.v);

  $: lineSeries = twrRows
    .map((r) => ({ date: r.periodDate, v: Number.parseFloat(r.valuationEndAmount) }))
    .filter((x) => Number.isFinite(x.v));
  $: growthLineSeries = lineSeries.slice(-180);
  $: growthLineLabels = growthLineSeries.map((x) => x.date);
  $: growthLineValues = growthLineSeries.map((x) => x.v);

  $: totalCostBasis = (() => {
    let s = 0;
    for (const p of positions) {
      const n = Number.parseFloat(p.costBasisAmount);
      if (Number.isFinite(n)) {
        s += n;
      }
    }
    return s;
  })();

  $: totalMarketValue = portfolioSnap === null ? 0 : Number.parseFloat(portfolioSnap.totalMarketValueAmount);
  $: totalGainLoss = Number.isFinite(totalMarketValue) && Number.isFinite(totalCostBasis) ? totalMarketValue - totalCostBasis : 0;
  $: totalGainLossPct =
    Number.isFinite(totalCostBasis) && totalCostBasis > 0 && Number.isFinite(totalGainLoss) ? (totalGainLoss / totalCostBasis) * 100 : 0;

  $: activeAlertCount = priorityItems.filter((i) => i.priorityRank <= 2).length;

  $: recentTransactions = (() => {
    const rows: TransactionDto[] = transactions.filter((t) => !t.isDeleted);
    rows.sort((a, b) => {
      if (a.tradeDate !== b.tradeDate) {
        return a.tradeDate < b.tradeDate ? 1 : -1;
      }
      return a.transactionId < b.transactionId ? 1 : -1;
    });
    return rows.slice(0, 5);
  })();

  function txTypeBadgeClass(t: string): string {
    if (t === 'BUY') {
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200';
    }
    if (t === 'SELL') {
      return 'bg-slate-100 text-slate-900 dark:bg-muted dark:text-foreground';
    }
    if (t === 'DIVIDEND') {
      return 'border border-gray-300 bg-transparent text-gray-800 dark:border-border dark:text-foreground';
    }
    return 'bg-gray-100 text-gray-900 dark:bg-muted dark:text-foreground';
  }

  function txAmountTone(t: TransactionDto): string {
    if (t.transactionType === 'BUY' || (t.transactionType === 'ADJUSTMENT' && t.grossAmount === undefined)) {
      return 'text-red-600 dark:text-red-400';
    }
    return 'text-emerald-600 dark:text-emerald-400';
  }

  async function load(): Promise<void> {
    isLoading = true;
    try {
      const [pf, snap, ast, twr, config, txs] = await Promise.all([
        apiClient.executeJson<PortfolioDto>({ method: 'GET', path: '/portfolio' }),
        apiClient.executeJson<{
          readonly snapshotDate: string | null;
          readonly portfolio: PortfolioSnap | null;
          readonly positions: readonly PositionRow[];
        }>({ method: 'GET', path: '/snapshots/latest' }),
        apiClient.executeJson<{ readonly items: readonly AssetDto[] }>({
          method: 'GET',
          path: '/assets',
          query: { active: 'all' },
        }),
        apiClient.executeJson<{ readonly items: readonly TwrRow[] }>({ method: 'GET', path: '/performance/twr' }),
        apiClient.executeJson<PortfolioConfigDto>({ method: 'GET', path: '/portfolio/config' }),
        apiClient.executeJson<{ readonly items: readonly TransactionDto[] }>({
          method: 'GET',
          path: '/transactions',
          query: { includeDeleted: 'false' },
        }),
      ]);
      portfolio = pf;
      snapshotDate = snap.snapshotDate;
      portfolioSnap = snap.portfolio;
      positions = snap.positions;
      assets = ast.items;
      twrRows = twr.items;
      transactions = txs.items;
      maxSingleAssetPct = readMaxSingleAssetPct(config.concentrationLimits);
      try {
        snapshotStatus = await apiClient.executeJson<SnapshotStatus>({ method: 'GET', path: '/snapshots/status' });
      } catch {
        snapshotStatus = undefined;
      }
      try {
        latestRec = await fetchRecommendationLatestSummary({ client: apiClient });
      } catch {
        latestRec = null;
      }
      if (latestRec !== null) {
        try {
          const detail = await getRecommendationRunDetail({ client: apiClient, runId: latestRec.runId });
          const sorted: RecommendationItemDto[] = [...detail.items].sort((a, b) => a.priorityRank - b.priorityRank);
          priorityItems = sorted.slice(0, 8);
        } catch {
          priorityItems = [];
        }
      } else {
        priorityItems = [];
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<section class="space-y-6">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Portfolio Overview</h1>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">Monitor your investments and track performance</p>
    </div>
    <button
      type="button"
      class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent"
      disabled={isLoading}
      on:click={() => void load()}
    >
      {isLoading ? 'Loading…' : 'Reload'}
    </button>
  </header>

  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if portfolioSnap === null}
    <div
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-border dark:bg-muted/30"
    >
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        No snapshot yet. Add assets, ledger transactions, and prices — then rebuild snapshots from the Prices page.
      </p>
    </div>
  {:else}
    {@const base = portfolio?.baseCurrencyCode ?? 'USD'}
    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Total Portfolio Value</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-foreground">
          {formatMaskedMoney({ masked, decimalString: portfolioSnap.totalMarketValueAmount, currencyCode: base })}
        </div>
        <div class="mt-2 flex items-center gap-2 text-sm font-medium">
          {#if totalGainLoss >= 0}
            <TrendingUp class="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span class="text-emerald-600 dark:text-emerald-400">
              {formatMaskedMoney({ masked, decimalString: String(Math.abs(totalGainLoss)), currencyCode: base })} ({formatNumberAsPercent2(
                totalGainLossPct,
              )})
            </span>
          {:else}
            <TrendingDown class="h-4 w-4 text-red-600" aria-hidden="true" />
            <span class="text-red-600 dark:text-red-400">
              {formatMaskedMoney({ masked, decimalString: String(Math.abs(totalGainLoss)), currencyCode: base })} ({formatNumberAsPercent2(
                totalGainLossPct,
              )})
            </span>
          {/if}
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-muted-foreground">As of {snapshotDate ?? '—'}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Total Cost Basis</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-foreground">
          {formatMaskedMoney({ masked, decimalString: String(totalCostBasis), currencyCode: base })}
        </div>
        <div class="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-muted-foreground">
          <DollarSign class="h-4 w-4 text-gray-500" aria-hidden="true" />
          <span>Initial investment (sum of position cost)</span>
        </div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Active Alerts</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-foreground">{activeAlertCount}</div>
        <div class="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-muted-foreground">
          <AlertCircle class="h-4 w-4 text-amber-600" aria-hidden="true" />
          <span>High-priority recommendations (top ranks)</span>
        </div>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Unrealised P/L</div>
        <div class="mt-1 text-xl font-semibold text-gray-900 dark:text-foreground">
          <PnlMoneyWithArrow masked={masked} decimalString={portfolioSnap.totalUnrealisedPnlAmount} currencyCode={base} />
        </div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Realised P/L (cumulative)</div>
        <div class="mt-1 text-xl font-semibold text-gray-900 dark:text-foreground">
          <PnlMoneyWithArrow masked={masked} decimalString={portfolioSnap.totalRealisedPnlAmount} currencyCode={base} />
        </div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Data freshness</div>
        <div class="mt-1 text-sm text-gray-900 dark:text-foreground">Snapshot: {snapshotDate ?? '—'}</div>
        {#if snapshotStatus?.earliestAffectedDate}
          <div class="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Stale from {snapshotStatus.earliestAffectedDate} — rebuild snapshots.
          </div>
        {:else}
          <div class="mt-1 text-xs text-gray-500 dark:text-muted-foreground">No pending invalidation.</div>
        {/if}
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <PieChartPanel
        title="Asset Allocation"
        description="By listed instrument type (stock vs ETF)"
        labels={assetClassPieLabels}
        values={assetClassPieValues}
        currencyCode={base}
        emptyMessage="No positions to chart yet."
      />
      <PieChartPanel
        title="Stocks by Sector"
        description="Stock positions only, grouped by sector tag"
        labels={sectorPieLabels}
        values={sectorPieValues}
        currencyCode={base}
        emptyMessage="No stock positions or sector tags yet."
      />
    </div>

    {#if masked}
      <div
        class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 text-sm text-gray-600 dark:border-border dark:bg-muted/30 dark:text-muted-foreground"
      >
        Charts are hidden while amounts are anonymized. Unlock amounts from the header to see allocation and trends.
      </div>
    {:else}
      <LineChartPanel
        title="Portfolio Growth"
        description="Recent end-of-period valuations (up to ~6 months of daily points)"
        labels={growthLineLabels}
        values={growthLineValues}
        datasetLabel={`Portfolio value (${base})`}
        currencyCode={base}
        emptyMessage="No performance rows yet — add data and rebuild snapshots."
      />
    {/if}

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <h2 class="text-base font-semibold text-gray-900 dark:text-foreground">Recent Transactions</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Latest ledger entries (non-deleted)</p>
        {#if recentTransactions.length === 0}
          <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">No transactions yet.</p>
        {:else}
          <ul class="mt-4 space-y-4">
            {#each recentTransactions as tx (tx.transactionId)}
              {@const ast = assetById.get(tx.assetId)}
              <li class="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-border">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${txTypeBadgeClass(tx.transactionType)}`}>
                      {tx.transactionType.toLowerCase()}
                    </span>
                    <a class="truncate font-medium text-emerald-700 hover:underline dark:text-emerald-400" href={`/assets/${tx.assetId}`}>
                      {ast?.name ?? ast?.symbol ?? tx.assetId}
                    </a>
                  </div>
                  <p class="mt-1 text-sm text-gray-500 dark:text-muted-foreground">{tx.tradeDate}</p>
                </div>
                <div class="shrink-0 text-right">
                  <p class={`font-medium ${txAmountTone(tx)}`}>
                    {#if tx.grossAmount}
                      {tx.transactionType === 'BUY' ? '−' : '+'}
                      {formatMaskedMoney({ masked, decimalString: tx.grossAmount, currencyCode: tx.currencyCode })}
                    {:else if tx.quantity && tx.unitPrice}
                      {formatMaskedMoney({
                        masked,
                        decimalString: tx.unitPrice,
                        currencyCode: tx.currencyCode,
                      })}
                      <span class="block text-xs text-gray-500 dark:text-muted-foreground">@{tx.quantity} qty</span>
                    {:else}
                      —
                    {/if}
                  </p>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <h2 class="text-base font-semibold text-gray-900 dark:text-foreground">Priority Recommendations</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Latest run — highest-ranked items</p>
        {#if latestRec === null}
          <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">
            No runs yet. Open Recommendations to execute a rules + AI pass on your current snapshot.
          </p>
        {:else if priorityItems.length === 0}
          <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">No items in the latest run.</p>
        {:else}
          <ul class="mt-4 space-y-3">
            {#each priorityItems as item (item.itemId)}
              <li class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <AlertCircle class="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <span class="font-medium text-gray-900 dark:text-foreground">{item.headline}</span>
                    </div>
                    <p class="mt-2 text-sm text-gray-700 dark:text-muted-foreground">{item.rationale}</p>
                  </div>
                  <span class="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-border dark:text-muted-foreground">
                    {item.source}
                  </span>
                </div>
              </li>
            {/each}
          </ul>
          <a
            class="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            href={`/recommendations/${latestRec.runId}`}
          >
            View run detail
          </a>
        {/if}
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-foreground">Top holdings</h2>
        <a class="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400" href="/assets">All holdings</a>
      </div>
      <ul class="mt-3 divide-y divide-gray-100 dark:divide-border">
        {#each sortedTop as row (row.assetId)}
          <li class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <a class="font-medium text-emerald-700 hover:underline dark:text-emerald-400" href={`/assets/${row.assetId}`}>
              {row.label}
            </a>
            <span class="text-gray-700 dark:text-muted-foreground">
              {formatMaskedMoney({ masked, decimalString: row.marketValueAmount, currencyCode: base })}
              {#if row.allocationPct}
                <span class="text-gray-500"> · {formatPortfolioAllocationPercent(row.allocationPct)}</span>
                {#if exceedsMaxSingleAsset({ allocationPct: row.allocationPct, maxSingleAssetPct })}
                  <span class="ml-1 inline-flex align-middle">
                    <WarningIndicator
                      message={`Exceeds max single asset threshold (${formatNumberAsPercent2(maxSingleAssetPct)}).`}
                      ariaLabel="Concentration warning details"
                    />
                  </span>
                {/if}
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </div>

  {/if}

  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/assets"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Holdings</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Full positions table and asset drill-down.</p>
    </a>
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/ledger"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Ledger</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Transactions that drive FIFO holdings.</p>
    </a>
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/performance"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Performance</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">TWR detail and presets.</p>
    </a>
  </div>
</section>
