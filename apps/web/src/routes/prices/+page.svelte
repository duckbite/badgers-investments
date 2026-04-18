<svelte:head>
  <title>Prices · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';
  import { amountPrivacy } from '$lib/privacy/amount-privacy-store';
  import { formatMaskedMoney } from '$lib/privacy/format-amount';

  type AssetDto = {
    readonly assetId: string;
    readonly name: string;
    readonly symbol: string;
    readonly currencyCode: string;
    readonly primaryPriceProviderKey: string | undefined;
  };

  type PriceSnapshotDto = {
    readonly priceSnapshotId: string;
    readonly assetId: string;
    readonly price: string;
    readonly currencyCode: string;
    readonly priceTimestamp: string;
    readonly priceDate: string;
    readonly providerKey: string | undefined;
    readonly dataQuality: string | undefined;
    readonly rawPayloadHash: string | undefined;
    readonly createdAt: string;
  };

  type MarketPriceStatusDto = {
    readonly lastRunStartedAt: string | null;
    readonly lastRunFinishedAt: string | null;
    readonly lastRunOk: boolean | null;
    readonly lastRunErrorMessage: string | null;
    readonly symbolsProcessed: number | null;
    readonly lastProviderKey: string | null;
  };

  let assets: readonly AssetDto[] = [];
  let latestByAssetId: Record<string, PriceSnapshotDto | null> = {};
  let selectedAssetId: string = '';
  let priceInput: string = '';
  let isLoading: boolean = true;
  let isSaving: boolean = false;
  let isRebuilding: boolean = false;
  let isRunningMarketJob: boolean = false;
  let marketStatus: MarketPriceStatusDto | null | undefined = undefined;

  type MarketPriceRunResultDto = {
    readonly usersProcessed: number;
    readonly snapshotsWritten: number;
    readonly errors: readonly string[];
    readonly userIdsConfigured: number;
    readonly userIdSource: 'env' | 'scan';
  };

  $: masked = $amountPrivacy;

  $: manualAssets = assets.filter((a) => a.primaryPriceProviderKey === undefined || a.primaryPriceProviderKey === '');

  async function loadAssets(): Promise<void> {
    const response = await apiClient.executeJson<{ readonly items: readonly AssetDto[] }>({
      method: 'GET',
      path: '/assets',
      query: { active: 'active' },
    });
    assets = response.items;
    const manual: readonly AssetDto[] = assets.filter(
      (a) => a.primaryPriceProviderKey === undefined || a.primaryPriceProviderKey === '',
    );
    if (selectedAssetId.length === 0 || !manual.some((a) => a.assetId === selectedAssetId)) {
      selectedAssetId = manual[0]?.assetId ?? '';
    }
  }

  async function loadLatestPrices(): Promise<void> {
    const next: Record<string, PriceSnapshotDto | null> = {};
    for (const asset of assets) {
      try {
        const latest = await apiClient.executeJson<PriceSnapshotDto | null>({
          method: 'GET',
          path: '/prices/latest',
          query: { assetId: asset.assetId },
        });
        next[asset.assetId] = latest;
      } catch {
        next[asset.assetId] = null;
      }
    }
    latestByAssetId = next;
  }

  async function loadMarketStatus(): Promise<void> {
    try {
      marketStatus = await apiClient.executeJson<MarketPriceStatusDto | null>({
        method: 'GET',
        path: '/market-prices/status',
      });
    } catch {
      marketStatus = null;
    }
  }

  async function refreshAll(): Promise<void> {
    isLoading = true;
    try {
      await loadAssets();
      await loadLatestPrices();
      await loadMarketStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load prices');
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void refreshAll();
  });

  async function saveManualPrice(): Promise<void> {
    if (selectedAssetId.length === 0) {
      toast.error('Select an asset');
      return;
    }
    const asset: AssetDto | undefined = assets.find((a) => a.assetId === selectedAssetId);
    if (asset === undefined) {
      toast.error('Asset not found');
      return;
    }
    isSaving = true;
    try {
      await apiClient.executeJson<PriceSnapshotDto, { assetId: string; price: string; currencyCode: string }>({
        method: 'POST',
        path: '/prices/manual',
        body: {
          assetId: selectedAssetId,
          price: priceInput.trim(),
          currencyCode: asset.currencyCode,
        },
      });
      priceInput = '';
      toast.success('Price saved');
      await loadLatestPrices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      isSaving = false;
    }
  }

  async function rebuildSnapshots(): Promise<void> {
    isRebuilding = true;
    try {
      const result = await apiClient.executeJson<
        {
          readonly fromDate: string;
          readonly throughDate: string;
          readonly daysProcessed: number;
        },
        Record<string, never>
      >({
        method: 'POST',
        path: '/snapshots/rebuild',
        body: {},
      });
      toast.success(`Snapshots rebuilt (${result.daysProcessed} days through ${result.throughDate})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rebuild failed');
    } finally {
      isRebuilding = false;
    }
  }

  async function runMarketPriceJob(): Promise<void> {
    isRunningMarketJob = true;
    try {
      const result = await apiClient.executeJson<MarketPriceRunResultDto, Record<string, never>>({
        method: 'POST',
        path: '/market-prices/run',
        body: {},
      });
      if (result.errors.length > 0) {
        toast.error(`Market price job finished with errors: ${result.errors.join('; ')}`);
      } else {
        toast.success(
          `Market prices updated (${result.snapshotsWritten} snapshot(s), ${result.usersProcessed} user portfolio(s), source=${result.userIdSource})`,
        );
      }
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Market price job failed');
    } finally {
      isRunningMarketJob = false;
    }
  }
</script>

<section class="space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Prices</h1>
    <p class="text-sm text-gray-600 dark:text-muted-foreground">
      Manual prices apply only to assets without automatic market pricing. Provider-backed assets are updated by the daily job.
      Rebuild derived snapshots after large backfills.
    </p>
  </header>

  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent"
      disabled={isLoading}
      on:click={() => void refreshAll()}
    >
      {isLoading ? 'Refreshing…' : 'Refresh'}
    </button>
    <button
      type="button"
      class="rounded-md border border-sky-700 bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      disabled={isRunningMarketJob}
      on:click={() => void runMarketPriceJob()}
      title="Runs the same Yahoo batch job as the daily worker (all configured user portfolios)."
    >
      {isRunningMarketJob ? 'Updating market prices…' : 'Run market price job'}
    </button>
    <button
      type="button"
      class="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      disabled={isRebuilding}
      on:click={() => void rebuildSnapshots()}
    >
      {isRebuilding ? 'Rebuilding…' : 'Rebuild snapshots'}
    </button>
  </div>

  {#if marketStatus !== undefined && marketStatus !== null}
    <div
      class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-border dark:bg-muted/40 dark:text-foreground"
    >
      <span class="font-medium">Last market price job:</span>
      {#if marketStatus.lastRunFinishedAt}
        {marketStatus.lastRunFinishedAt}
        {#if marketStatus.lastRunOk === true}
          <span class="text-emerald-700 dark:text-emerald-400"> · ok</span>
        {:else if marketStatus.lastRunOk === false}
          <span class="text-amber-800 dark:text-amber-300"> · failed</span>
        {/if}
        {#if marketStatus.symbolsProcessed != null}
          <span class="text-slate-600 dark:text-muted-foreground"> · {marketStatus.symbolsProcessed} Yahoo quote(s)</span>
        {/if}
        {#if marketStatus.lastRunOk === false && marketStatus.lastRunErrorMessage}
          <p class="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-amber-900 dark:text-amber-200">
            {marketStatus.lastRunErrorMessage}
          </p>
        {/if}
      {:else}
        <span class="text-slate-600 dark:text-muted-foreground">No run recorded yet — use Run market price job above or the scheduled worker.</span>
      {/if}
    </div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-2">
    <div class="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">Add manual price</h2>
      {#if manualAssets.length === 0}
        <p class="text-sm text-gray-600 dark:text-muted-foreground">
          All active assets use automatic market pricing. Clear the provider on an asset (PATCH) to enable manual entry for that
          symbol.
        </p>
      {:else}
      <label class="block space-y-1">
        <span class="text-sm text-gray-600 dark:text-muted-foreground">Asset</span>
        <select
          class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-background dark:text-foreground"
          bind:value={selectedAssetId}
        >
          {#each manualAssets as asset (asset.assetId)}
            <option value={asset.assetId}>{asset.symbol} — {asset.name}</option>
          {/each}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-sm text-gray-600 dark:text-muted-foreground">Price</span>
        <input
          type="text"
          inputmode="decimal"
          class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-background dark:text-foreground"
          placeholder="e.g. 142.50"
          bind:value={priceInput}
        />
      </label>
      <p class="text-xs text-gray-500 dark:text-muted-foreground">
        Currency matches the asset. Timestamp defaults to now; valuation date follows the API rules.
      </p>
      <button
        type="button"
        class="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        disabled={isSaving || selectedAssetId.length === 0}
        on:click={() => void saveManualPrice()}
      >
        {isSaving ? 'Saving…' : 'Save price snapshot'}
      </button>
      {/if}
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">Latest per asset</h2>
      {#if isLoading}
        <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
      {:else if assets.length === 0}
        <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">No active assets yet.</p>
      {:else}
        <ul class="mt-3 divide-y divide-gray-100 dark:divide-border">
          {#each assets as asset (asset.assetId)}
            {@const latest = latestByAssetId[asset.assetId]}
            <li class="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
              <span class="font-medium text-gray-900 dark:text-foreground">{asset.symbol}</span>
              {#if latest === undefined || latest === null}
                <span class="text-gray-500 dark:text-muted-foreground">No snapshot</span>
              {:else}
                <span class="text-gray-800 dark:text-foreground">
                  {formatMaskedMoney({ masked, decimalString: latest.price, currencyCode: latest.currencyCode })}
                  <span class="text-gray-500 dark:text-muted-foreground">({latest.priceDate})</span>
                  {#if latest.providerKey}
                    <span class="ml-1 text-xs text-gray-500 dark:text-muted-foreground">· {latest.providerKey}</span>
                  {/if}
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</section>
