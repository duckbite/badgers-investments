<svelte:head>
  <title>Asset · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';
  import SimpleLineChart from '$lib/components/SimpleLineChart.svelte';
  import { amountPrivacy } from '$lib/privacy/amount-privacy-store';
  import { formatMaskedMoney, formatMaskedNumber } from '$lib/privacy/format-amount';
  import { formatInstrumentDisplayLabel } from '$lib/formatting/instrument-display-label';
  import { formatMatchedLotRealisedPnlPercent } from '$lib/formatting/matched-lot-realised-pnl-percent';
  import PnlMoneyWithArrow from '$lib/components/PnlMoneyWithArrow.svelte';

  type AssetDto = {
    readonly assetId: string;
    readonly name: string;
    readonly symbol: string;
    readonly currencyCode: string;
    readonly sector: string | undefined;
    readonly notes: string | undefined;
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

  type TransactionDto = {
    readonly transactionId: string;
    readonly assetId: string;
    readonly transactionType: string;
    readonly tradeDate: string;
    readonly quantity: string | undefined;
    readonly unitPrice: string | undefined;
    readonly grossAmount: string | undefined;
    readonly feeAmount: string | undefined;
    readonly currencyCode: string;
    readonly notes: string | undefined;
    readonly adjustmentSide: string | undefined;
    readonly isDeleted: boolean;
  };

  type LotLink = {
    readonly linkId: string;
    readonly sellTransactionId: string;
    readonly buyTransactionId: string;
    readonly matchedQuantity: string;
    readonly buyUnitPrice: string;
    readonly sellUnitPrice: string;
    readonly realisedPnlAmount: string;
    readonly currencyCode: string;
  };

  type PriceRow = {
    readonly priceDate: string;
    readonly price: string;
  };

  type PortfolioDto = {
    readonly baseCurrencyCode: string;
  };

  let portfolio: PortfolioDto | undefined;
  let asset: AssetDto | undefined;
  let position: PositionRow | undefined;
  let transactions: readonly TransactionDto[] = [];
  let lotLinks: readonly LotLink[] = [];
  let prices: readonly PriceRow[] = [];
  let isLoading: boolean = true;

  $: assetId = $page.params.assetId ?? '';
  $: masked = $amountPrivacy;

  $: priceSeries = [...prices]
    .reverse()
    .map((p) => ({ label: p.priceDate, v: Number.parseFloat(p.price) }))
    .filter((x) => Number.isFinite(x.v));
  $: priceLabels = priceSeries.map((x) => x.label);
  $: priceValues = priceSeries.map((x) => x.v);

  $: txIdSet = new Set(transactions.map((t) => t.transactionId));
  $: assetLotLinks = lotLinks.filter((l) => txIdSet.has(l.buyTransactionId) || txIdSet.has(l.sellTransactionId));

  async function load(): Promise<void> {
    if (assetId.length === 0) {
      return;
    }
    isLoading = true;
    try {
      const [pf, snap, astItems, txs, holdings, priceItems] = await Promise.all([
        apiClient.executeJson<PortfolioDto>({ method: 'GET', path: '/portfolio' }),
        apiClient.executeJson<{ readonly positions: readonly PositionRow[] }>({ method: 'GET', path: '/snapshots/latest' }),
        apiClient.executeJson<{ readonly items: readonly AssetDto[] }>({
          method: 'GET',
          path: '/assets',
          query: { active: 'all' },
        }),
        apiClient.executeJson<{ readonly items: readonly TransactionDto[] }>({
          method: 'GET',
          path: '/transactions',
          query: { assetId, includeDeleted: 'false' },
        }),
        apiClient.executeJson<{ readonly lotLinks: readonly LotLink[] }>({ method: 'GET', path: '/holdings' }),
        apiClient.executeJson<{ readonly items: readonly { readonly priceDate: string; readonly price: string }[] }>({
          method: 'GET',
          path: '/prices',
          query: { assetId, limit: 120 },
        }),
      ]);
      portfolio = pf;
      asset = astItems.items.find((a) => a.assetId === assetId);
      position = snap.positions.find((p) => p.assetId === assetId);
      transactions = txs.items;
      lotLinks = holdings.lotLinks;
      prices = priceItems.items;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load asset');
    } finally {
      isLoading = false;
    }
  }

  afterNavigate(() => {
    void load();
  });
</script>

<section class="space-y-6">
  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if asset === undefined}
    <div
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-border dark:bg-muted/30"
    >
      <p class="text-sm text-gray-600 dark:text-muted-foreground">Asset not found.</p>
      <a class="mt-2 inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-400" href="/assets">← Holdings</a>
    </div>
  {:else}
    {@const base = portfolio?.baseCurrencyCode ?? 'USD'}
    <header class="space-y-1">
      <a class="text-sm text-emerald-700 hover:underline dark:text-emerald-400" href="/assets">← Holdings</a>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">
        {formatInstrumentDisplayLabel({ name: asset.name, symbol: asset.symbol, fallbackId: asset.assetId })}
      </h1>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        {asset.sector ?? 'Sector not set'} · {asset.isActive ? 'Active' : 'Archived'} · {asset.currencyCode}
      </p>
      {#if asset.notes}
        <p class="text-sm text-gray-700 dark:text-muted-foreground">{asset.notes}</p>
      {/if}
    </header>

    {#if position === undefined}
      <div
        class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-border dark:bg-muted/30"
      >
        <p class="text-sm text-gray-600 dark:text-muted-foreground">No snapshot row for this asset yet.</p>
      </div>
    {:else}
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
          <div class="text-xs font-medium uppercase text-gray-500 dark:text-muted-foreground">Quantity</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-foreground">
            {formatMaskedNumber({ masked, decimalString: position.quantityHeld, maximumFractionDigits: 8 })}
          </div>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
          <div class="text-xs font-medium uppercase text-gray-500 dark:text-muted-foreground">Market value</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-foreground">
            {formatMaskedMoney({ masked, decimalString: position.marketValueAmount, currencyCode: base })}
          </div>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
          <div class="text-xs font-medium uppercase text-gray-500 dark:text-muted-foreground">Unrealised P/L</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-foreground">
            <PnlMoneyWithArrow masked={masked} decimalString={position.unrealisedPnlAmount} currencyCode={base} />
          </div>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
          <div class="text-xs font-medium uppercase text-gray-500 dark:text-muted-foreground">Realised P/L (snap)</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-foreground">
            <PnlMoneyWithArrow masked={masked} decimalString={position.realisedPnlCumulativeAmount} currencyCode={base} />
          </div>
        </div>
      </div>
    {/if}

    <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-foreground">Price history</h2>
      {#if masked}
        <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">Chart hidden while amounts are anonymized.</p>
      {:else if priceLabels.length === 0}
        <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">No manual prices recorded for this asset.</p>
      {:else}
        <div class="mt-4">
          <SimpleLineChart
            labels={priceLabels}
            values={priceValues}
            datasetLabel={`${asset.symbol} price`}
            yTickCurrency={asset.currencyCode}
          />
        </div>
      {/if}
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-foreground">FIFO matches (realised)</h2>
      <p class="mt-1 text-xs text-gray-500 dark:text-muted-foreground">
        Lot links from the ledger FIFO engine for sells against prior buys. Open lots are not itemised in the API response.
      </p>
      {#if assetLotLinks.length === 0}
        <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">No realised lot matches involving this asset.</p>
      {:else}
        <div class="mt-3 overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/40">
              <tr>
                <th class="px-3 py-2 font-medium">Matched qty</th>
                <th class="px-3 py-2 font-medium">Buy @</th>
                <th class="px-3 py-2 font-medium">Sell @</th>
                <th class="px-3 py-2 font-medium">Realised P/L</th>
              </tr>
            </thead>
            <tbody>
              {#each assetLotLinks as row (row.linkId)}
                {@const lotPct = formatMatchedLotRealisedPnlPercent({
                  matchedQuantity: row.matchedQuantity,
                  buyUnitPrice: row.buyUnitPrice,
                  realisedPnlAmount: row.realisedPnlAmount,
                })}
                <tr class="border-b border-gray-100 dark:border-border">
                  <td class="px-3 py-2 text-gray-800 dark:text-foreground">
                    {formatMaskedNumber({ masked, decimalString: row.matchedQuantity, maximumFractionDigits: 8 })}
                  </td>
                  <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                    {formatMaskedMoney({ masked, decimalString: row.buyUnitPrice, currencyCode: row.currencyCode })}
                  </td>
                  <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                    {formatMaskedMoney({ masked, decimalString: row.sellUnitPrice, currencyCode: row.currencyCode })}
                  </td>
                  <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                    <PnlMoneyWithArrow
                      masked={masked}
                      decimalString={row.realisedPnlAmount}
                      currencyCode={row.currencyCode}
                      percentNumberPart={lotPct}
                    />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-foreground">Transactions</h2>
      {#if transactions.length === 0}
        <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">No transactions for this asset.</p>
      {:else}
        <div class="mt-3 overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/40">
              <tr>
                <th class="px-3 py-2 font-medium">Date</th>
                <th class="px-3 py-2 font-medium">Type</th>
                <th class="px-3 py-2 font-medium">Qty</th>
                <th class="px-3 py-2 font-medium">Unit</th>
                <th class="px-3 py-2 font-medium">Gross</th>
                <th class="px-3 py-2 font-medium">Fee</th>
                <th class="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {#each transactions as tx (tx.transactionId)}
                <tr class="border-b border-gray-100 dark:border-border">
                  <td class="px-3 py-2 text-gray-800 dark:text-foreground">{tx.tradeDate}</td>
                  <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                    {tx.transactionType}
                    {tx.adjustmentSide ? ` (${tx.adjustmentSide})` : ''}
                  </td>
                  <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                    {tx.quantity ? formatMaskedNumber({ masked, decimalString: tx.quantity, maximumFractionDigits: 8 }) : '—'}
                  </td>
                  <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                    {tx.unitPrice
                      ? formatMaskedMoney({ masked, decimalString: tx.unitPrice, currencyCode: tx.currencyCode })
                      : '—'}
                  </td>
                  <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                    {tx.grossAmount
                      ? formatMaskedMoney({ masked, decimalString: tx.grossAmount, currencyCode: tx.currencyCode })
                      : '—'}
                  </td>
                  <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                    {tx.feeAmount
                      ? formatMaskedMoney({ masked, decimalString: tx.feeAmount, currencyCode: tx.currencyCode })
                      : '—'}
                  </td>
                  <td class="px-3 py-2 text-gray-600 dark:text-muted-foreground">{tx.notes ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</section>
