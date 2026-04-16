<svelte:head>
  <title>Assets · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';
  import { amountPrivacy } from '$lib/privacy/amount-privacy-store';
  import { formatMaskedMoney, formatMaskedNumber } from '$lib/privacy/format-amount';
  import { formatInstrumentDisplayLabel } from '$lib/formatting/instrument-display-label';
  import { formatPortfolioAllocationPercent } from '$lib/formatting/percent-display';
  import PnlMoneyWithArrow from '$lib/components/PnlMoneyWithArrow.svelte';
  import WarningIndicator from '$lib/components/WarningIndicator.svelte';

  type AssetDto = {
    readonly assetId: string;
    readonly name: string;
    readonly symbol: string;
    readonly currencyCode: string;
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

  type PortfolioDto = {
    readonly baseCurrencyCode: string;
  };

  type PortfolioConfigDto = {
    readonly concentrationLimits: unknown;
  };

  let portfolio: PortfolioDto | undefined;
  let positions: readonly PositionRow[] = [];
  let assets: readonly AssetDto[] = [];
  let activeFilter: 'active' | 'archived' | 'all' = 'active';
  let isLoading: boolean = true;
  let maxSingleAssetPct: number = 100;

  $: masked = $amountPrivacy;
  $: assetById = new Map(assets.map((a) => [a.assetId, a] as const));
  $: filteredAssets = assets.filter((a) => {
    if (activeFilter === 'active') {
      return a.isActive;
    }
    if (activeFilter === 'archived') {
      return !a.isActive;
    }
    return true;
  });
  $: positionByAsset = new Map(positions.map((p) => [p.assetId, p] as const));

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

  async function load(): Promise<void> {
    isLoading = true;
    try {
      const [pf, snap, ast, config] = await Promise.all([
        apiClient.executeJson<PortfolioDto>({ method: 'GET', path: '/portfolio' }),
        apiClient.executeJson<{ readonly positions: readonly PositionRow[] }>({ method: 'GET', path: '/snapshots/latest' }),
        apiClient.executeJson<{ readonly items: readonly AssetDto[] }>({
          method: 'GET',
          path: '/assets',
          query: { active: 'all' },
        }),
        apiClient.executeJson<PortfolioConfigDto>({ method: 'GET', path: '/portfolio/config' }),
      ]);
      portfolio = pf;
      positions = snap.positions;
      assets = ast.items;
      maxSingleAssetPct = readMaxSingleAssetPct(config.concentrationLimits);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load holdings');
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<section class="space-y-4">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Holdings</h1>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        Stocks and ETFs from the latest snapshot (quantity, cost, price, value, P/L, allocation).
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground">
        <span class="text-gray-600 dark:text-muted-foreground">Assets</span>
        <select
          class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-border dark:bg-card dark:text-foreground"
          bind:value={activeFilter}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
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
  </header>

  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if positions.length === 0}
    <div
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-border dark:bg-muted/30"
    >
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        No position snapshots yet. Add ledger activity, prices, and rebuild snapshots.
      </p>
    </div>
  {:else}
    {@const base = portfolio?.baseCurrencyCode ?? 'USD'}
    <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/40">
          <tr>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Asset</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Sector</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Qty</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Cost basis</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Price</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Value</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Unrealised P/L</th>
            <th class="px-3 py-2 font-medium text-gray-900 dark:text-foreground">Alloc %</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredAssets as asset (asset.assetId)}
            {@const pos = positionByAsset.get(asset.assetId)}
            {#if pos !== undefined}
              <tr class="border-b border-gray-100 dark:border-border">
                <td class="px-3 py-2">
                  <a class="font-medium text-emerald-700 hover:underline dark:text-emerald-400" href={`/assets/${asset.assetId}`}>
                    {formatInstrumentDisplayLabel({ name: asset.name, symbol: asset.symbol, fallbackId: asset.assetId })}
                  </a>
                </td>
                <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">{asset.sector ?? '—'}</td>
                <td class="px-3 py-2 text-gray-800 dark:text-foreground">
                  {formatMaskedNumber({ masked, decimalString: pos.quantityHeld, maximumFractionDigits: 6 })}
                </td>
                <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                  {formatMaskedMoney({ masked, decimalString: pos.costBasisAmount, currencyCode: base })}
                </td>
                <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                  {#if pos.marketPrice === null}
                    —
                  {:else}
                    {formatMaskedMoney({ masked, decimalString: pos.marketPrice, currencyCode: asset.currencyCode })}
                  {/if}
                </td>
                <td class="px-3 py-2 text-gray-800 dark:text-foreground">
                  {formatMaskedMoney({ masked, decimalString: pos.marketValueAmount, currencyCode: base })}
                </td>
                <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                  <PnlMoneyWithArrow masked={masked} decimalString={pos.unrealisedPnlAmount} currencyCode={base} />
                </td>
                <td class="px-3 py-2 text-gray-600 dark:text-muted-foreground">
                  <div class="flex items-center gap-1.5">
                    <span>{formatPortfolioAllocationPercent(pos.allocationPct)}</span>
                    {#if exceedsMaxSingleAsset({ allocationPct: pos.allocationPct, maxSingleAssetPct })}
                      <WarningIndicator
                        message={`Above max single asset threshold (${maxSingleAssetPct}%).`}
                        ariaLabel="Concentration warning details"
                      />
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-gray-500 dark:text-muted-foreground">
      Holdings with zero quantity in the snapshot are omitted. Edit assets on the API or future admin UI; archived assets still appear when “All” is selected.
    </p>
  {/if}
</section>
