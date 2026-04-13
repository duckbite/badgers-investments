<svelte:head>
  <title>Dashboard · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';
  import PortfolioCharts from '$lib/components/PortfolioCharts.svelte';
  import { amountPrivacy } from '$lib/privacy/amount-privacy-store';
  import { formatMaskedMoney } from '$lib/privacy/format-amount';

  type PortfolioDto = {
    readonly portfolioId: string;
    readonly name: string;
    readonly baseCurrencyCode: string;
  };

  type AssetDto = {
    readonly assetId: string;
    readonly name: string;
    readonly symbol: string;
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

  type TwrRow = {
    readonly periodDate: string;
    readonly valuationEndAmount: string;
  };

  let portfolio: PortfolioDto | undefined;
  let snapshotDate: string | null = null;
  let portfolioSnap: PortfolioSnap | null = null;
  let positions: readonly PositionRow[] = [];
  let snapshotStatus: SnapshotStatus | undefined;
  let assets: readonly AssetDto[] = [];
  let twrRows: readonly TwrRow[] = [];
  let isLoading: boolean = true;

  $: assetById = new Map(assets.map((a) => [a.assetId, a] as const));
  $: masked = $amountPrivacy;

  $: sortedTop = [...positions]
    .map((p) => ({
      ...p,
      mv: Number.parseFloat(p.marketValueAmount),
      label: assetById.get(p.assetId)?.symbol ?? p.assetId.slice(0, 8),
    }))
    .filter((p) => Number.isFinite(p.mv) && p.mv > 0)
    .sort((a, b) => b.mv - a.mv)
    .slice(0, 5);

  $: sectorAlloc = (() => {
    const map: Map<string, number> = new Map();
    for (const p of positions) {
      const mv: number = Number.parseFloat(p.marketValueAmount);
      if (!Number.isFinite(mv) || mv <= 0) {
        continue;
      }
      const sector: string = assetById.get(p.assetId)?.sector?.trim() || 'Unspecified';
      map.set(sector, (map.get(sector) ?? 0) + mv);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  })();

  $: pieLabels = sortedTop.map((p) => p.label);
  $: pieValues = sortedTop.map((p) => p.mv);

  $: lineSeries = twrRows
    .map((r) => ({ date: r.periodDate, v: Number.parseFloat(r.valuationEndAmount) }))
    .filter((x) => Number.isFinite(x.v));
  $: lineLabels = lineSeries.map((x) => x.date);
  $: lineValues = lineSeries.map((x) => x.v);

  async function load(): Promise<void> {
    isLoading = true;
    try {
      const [pf, snap, ast, twr] = await Promise.all([
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
      ]);
      portfolio = pf;
      snapshotDate = snap.snapshotDate;
      portfolioSnap = snap.portfolio;
      positions = snap.positions;
      assets = ast.items;
      twrRows = twr.items;
      try {
        snapshotStatus = await apiClient.executeJson<SnapshotStatus>({ method: 'GET', path: '/snapshots/status' });
      } catch {
        snapshotStatus = undefined;
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
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Dashboard</h1>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        Wealth overview from the latest portfolio snapshot and TWR history.
      </p>
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
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Total value</div>
        <div class="mt-1 text-xl font-semibold text-gray-900 dark:text-foreground">
          {formatMaskedMoney({ masked, decimalString: portfolioSnap.totalMarketValueAmount, currencyCode: base })}
        </div>
        <div class="mt-1 text-xs text-gray-500 dark:text-muted-foreground">As of {snapshotDate ?? '—'}</div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Unrealised P/L</div>
        <div class="mt-1 text-xl font-semibold text-gray-900 dark:text-foreground">
          {formatMaskedMoney({ masked, decimalString: portfolioSnap.totalUnrealisedPnlAmount, currencyCode: base })}
        </div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Realised P/L (cumulative)</div>
        <div class="mt-1 text-xl font-semibold text-gray-900 dark:text-foreground">
          {formatMaskedMoney({ masked, decimalString: portfolioSnap.totalRealisedPnlAmount, currencyCode: base })}
        </div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Data freshness</div>
        <div class="mt-1 text-sm text-gray-900 dark:text-foreground">
          Snapshot: {snapshotDate ?? '—'}
        </div>
        {#if snapshotStatus?.earliestAffectedDate}
          <div class="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Stale from {snapshotStatus.earliestAffectedDate} — rebuild snapshots.
          </div>
        {:else}
          <div class="mt-1 text-xs text-gray-500 dark:text-muted-foreground">No pending invalidation.</div>
        {/if}
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2 dark:border-border dark:bg-card">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-foreground">Top holdings</h2>
        <ul class="mt-3 divide-y divide-gray-100 dark:divide-border">
          {#each sortedTop as row (row.assetId)}
            <li class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <a class="font-medium text-emerald-700 hover:underline dark:text-emerald-400" href={`/assets/${row.assetId}`}>
                {assetById.get(row.assetId)?.symbol ?? row.assetId}
              </a>
              <span class="text-gray-700 dark:text-muted-foreground">
                {formatMaskedMoney({ masked, decimalString: row.marketValueAmount, currencyCode: base })}
                {#if row.allocationPct}
                  <span class="text-gray-500"> · {row.allocationPct}%</span>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-foreground">Allocation by sector</h2>
        {#if sectorAlloc.length === 0}
          <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">No sector tags on assets yet.</p>
        {:else}
          <ul class="mt-3 space-y-2 text-sm">
            {#each sectorAlloc as [sector, mv] (sector)}
              <li class="flex justify-between gap-2">
                <span class="text-gray-800 dark:text-foreground">{sector}</span>
                <span class="text-gray-600 dark:text-muted-foreground">
                  {formatMaskedMoney({ masked, decimalString: String(mv), currencyCode: base })}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-foreground">Recommendations</h2>
      <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">
        Recommendation runs are not wired to the API yet — see the Recommendations page (coming soon).
      </p>
    </div>

    {#if masked}
      <div
        class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 text-sm text-gray-600 dark:border-border dark:bg-muted/30 dark:text-muted-foreground"
      >
        Charts are hidden while amounts are anonymized. Unlock amounts from the header to see allocation and value trends.
      </div>
    {:else}
      <PortfolioCharts
        pieLabels={pieLabels}
        pieValues={pieValues}
        lineLabels={lineLabels}
        lineValues={lineValues}
        currencyCode={base}
      />
    {/if}
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
