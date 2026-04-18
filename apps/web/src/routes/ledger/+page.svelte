<svelte:head>
  <title>Ledger · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';
  import { amountPrivacy } from '$lib/privacy/amount-privacy-store';
  import { formatMaskedMoney, formatMaskedNumber } from '$lib/privacy/format-amount';

  type AssetDto = {
    readonly assetId: string;
    readonly name: string;
    readonly symbol: string;
    readonly currencyCode: string;
    readonly isActive: boolean;
  };

  type TransactionDto = {
    readonly transactionId: string;
    readonly assetId: string;
    readonly transactionType: string;
    readonly tradeDate: string;
    readonly tradeTimestamp: string | undefined;
    readonly quantity: string | undefined;
    readonly unitPrice: string | undefined;
    readonly grossAmount: string | undefined;
    readonly feeAmount: string | undefined;
    readonly currencyCode: string;
    readonly notes: string | undefined;
    readonly adjustmentSide: string | undefined;
    readonly isDeleted: boolean;
  };

  const transactionTypes = ['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'ADJUSTMENT'] as const;

  let assets: readonly AssetDto[] = [];
  let items: readonly TransactionDto[] = [];
  let isLoading: boolean = true;
  let isSaving: boolean = false;

  let filterAssetId: string = '';
  let filterType: string = '';
  let filterDateFrom: string = '';
  let filterDateTo: string = '';
  let includeDeleted: boolean = false;

  type ModalState =
    | { readonly kind: 'closed' }
    | { readonly kind: 'create' }
    | { readonly kind: 'edit'; readonly tx: TransactionDto };

  let modal: ModalState = { kind: 'closed' };
  let deleteTarget: TransactionDto | undefined;

  let formAssetId: string = '';
  let formType: string = 'BUY';
  let formTradeDate: string = '';
  let formTradeTimestamp: string = '';
  let formQuantity: string = '';
  let formUnitPrice: string = '';
  let formGrossAmount: string = '';
  let formFeeAmount: string = '';
  let formNotes: string = '';
  let formAdjustmentSide: string = 'INCREASE';

  $: masked = $amountPrivacy;
  $: assetById = new Map(assets.map((a) => [a.assetId, a] as const));

  $: filtered = items.filter((row) => {
    if (filterAssetId.length > 0 && row.assetId !== filterAssetId) {
      return false;
    }
    if (filterType.length > 0 && row.transactionType !== filterType) {
      return false;
    }
    if (filterDateFrom.length > 0 && row.tradeDate < filterDateFrom) {
      return false;
    }
    if (filterDateTo.length > 0 && row.tradeDate > filterDateTo) {
      return false;
    }
    return true;
  });

  function resetForm(): void {
    formAssetId = assets[0]?.assetId ?? '';
    formType = 'BUY';
    formTradeDate = new Date().toISOString().slice(0, 10);
    formTradeTimestamp = '';
    formQuantity = '';
    formUnitPrice = '';
    formGrossAmount = '';
    formFeeAmount = '';
    formNotes = '';
    formAdjustmentSide = 'INCREASE';
  }

  function openCreate(): void {
    resetForm();
    modal = { kind: 'create' };
  }

  function openEdit(tx: TransactionDto): void {
    formAssetId = tx.assetId;
    formType = tx.transactionType;
    formTradeDate = tx.tradeDate;
    formTradeTimestamp = tx.tradeTimestamp ?? '';
    formQuantity = tx.quantity ?? '';
    formUnitPrice = tx.unitPrice ?? '';
    formGrossAmount = tx.grossAmount ?? '';
    formFeeAmount = tx.feeAmount ?? '';
    formNotes = tx.notes ?? '';
    formAdjustmentSide = tx.adjustmentSide ?? 'INCREASE';
    modal = { kind: 'edit', tx };
  }

  function closeModal(): void {
    modal = { kind: 'closed' };
  }

  async function refresh(): Promise<void> {
    isLoading = true;
    try {
      const [ast, txs] = await Promise.all([
        apiClient.executeJson<{ readonly items: readonly AssetDto[] }>({
          method: 'GET',
          path: '/assets',
          query: { active: 'all' },
        }),
        apiClient.executeJson<{ readonly items: readonly TransactionDto[] }>({
          method: 'GET',
          path: '/transactions',
          query: { includeDeleted: includeDeleted ? 'true' : 'false' },
        }),
      ]);
      assets = ast.items;
      items = txs.items;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load ledger');
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void refresh();
  });

  async function submitForm(): Promise<void> {
    if (formAssetId.length === 0) {
      toast.error('Select an asset');
      return;
    }
    const asset: AssetDto | undefined = assetById.get(formAssetId);
    if (asset === undefined) {
      toast.error('Asset not found');
      return;
    }
    isSaving = true;
    try {
      if (modal.kind === 'create') {
        const body: Record<string, string> = {
          assetId: formAssetId,
          transactionType: formType,
          tradeDate: formTradeDate,
          currencyCode: asset.currencyCode,
        };
        if (formTradeTimestamp.trim().length > 0) {
          body['tradeTimestamp'] = formTradeTimestamp.trim();
        }
        if (formQuantity.trim().length > 0) {
          body['quantity'] = formQuantity.trim();
        }
        if (formUnitPrice.trim().length > 0) {
          body['unitPrice'] = formUnitPrice.trim();
        }
        if (formGrossAmount.trim().length > 0) {
          body['grossAmount'] = formGrossAmount.trim();
        }
        if (formFeeAmount.trim().length > 0) {
          body['feeAmount'] = formFeeAmount.trim();
        }
        if (formNotes.trim().length > 0) {
          body['notes'] = formNotes.trim();
        }
        if (formType === 'ADJUSTMENT') {
          body['adjustmentSide'] = formAdjustmentSide;
        }
        await apiClient.executeJson<TransactionDto, Record<string, string>>({
          method: 'POST',
          path: '/transactions',
          body,
        });
        toast.success('Transaction created');
      } else if (modal.kind === 'edit') {
        const body: Record<string, string> = {};
        if (formAssetId !== modal.tx.assetId) {
          body['assetId'] = formAssetId;
        }
        if (formTradeDate !== modal.tx.tradeDate) {
          body['tradeDate'] = formTradeDate;
        }
        const nextTs: string | undefined = formTradeTimestamp.trim().length > 0 ? formTradeTimestamp.trim() : undefined;
        if (nextTs !== (modal.tx.tradeTimestamp ?? undefined)) {
          if (nextTs !== undefined) {
            body['tradeTimestamp'] = nextTs;
          }
        }
        if ((formQuantity || '') !== (modal.tx.quantity ?? '')) {
          body['quantity'] = formQuantity.trim();
        }
        if ((formUnitPrice || '') !== (modal.tx.unitPrice ?? '')) {
          body['unitPrice'] = formUnitPrice.trim();
        }
        if ((formGrossAmount || '') !== (modal.tx.grossAmount ?? '')) {
          body['grossAmount'] = formGrossAmount.trim();
        }
        if ((formFeeAmount || '') !== (modal.tx.feeAmount ?? '')) {
          body['feeAmount'] = formFeeAmount.trim();
        }
        if ((formNotes || '') !== (modal.tx.notes ?? '')) {
          body['notes'] = formNotes.trim();
        }
        if (modal.tx.transactionType === 'ADJUSTMENT' && formAdjustmentSide !== (modal.tx.adjustmentSide ?? '')) {
          body['adjustmentSide'] = formAdjustmentSide;
        }
        if (Object.keys(body).length === 0) {
          toast.success('No changes');
          closeModal();
          return;
        }
        await apiClient.executeJson<TransactionDto, Record<string, string>>({
          method: 'PATCH',
          path: `/transactions/${modal.tx.transactionId}`,
          body,
        });
        toast.success('Transaction updated');
      }
      closeModal();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      isSaving = false;
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === undefined) {
      return;
    }
    isSaving = true;
    try {
      await apiClient.executeJson<TransactionDto>({ method: 'DELETE', path: `/transactions/${deleteTarget.transactionId}` });
      toast.success('Transaction deleted');
      deleteTarget = undefined;
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      isSaving = false;
    }
  }
</script>

<section class="space-y-4">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Ledger</h1>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        Transactions (FIFO source of truth). Filter below; rebuild snapshots after material changes.
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        disabled={isLoading || assets.length === 0}
        on:click={openCreate}
      >
        Add transaction
      </button>
      <button
        type="button"
        class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent"
        disabled={isLoading}
        on:click={() => void refresh()}
      >
        {isLoading ? 'Loading…' : 'Reload'}
      </button>
    </div>
  </header>

  <div class="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
    <label class="flex flex-col gap-1 text-sm">
      <span class="text-gray-600 dark:text-muted-foreground">Asset</span>
      <select
        class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-border dark:bg-background dark:text-foreground"
        bind:value={filterAssetId}
      >
        <option value="">All</option>
        {#each assets as a (a.assetId)}
          <option value={a.assetId}>{a.symbol}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1 text-sm">
      <span class="text-gray-600 dark:text-muted-foreground">Type</span>
      <select
        class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-border dark:bg-background dark:text-foreground"
        bind:value={filterType}
      >
        <option value="">All</option>
        {#each transactionTypes as t (t)}
          <option value={t}>{t}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1 text-sm">
      <span class="text-gray-600 dark:text-muted-foreground">From</span>
      <input
        type="date"
        class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-border dark:bg-background dark:text-foreground"
        bind:value={filterDateFrom}
      />
    </label>
    <label class="flex flex-col gap-1 text-sm">
      <span class="text-gray-600 dark:text-muted-foreground">To</span>
      <input
        type="date"
        class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-border dark:bg-background dark:text-foreground"
        bind:value={filterDateTo}
      />
    </label>
    <label class="flex items-center gap-2 text-sm text-gray-800 dark:text-foreground">
      <input type="checkbox" bind:checked={includeDeleted} on:change={() => void refresh()} />
      Include deleted
    </label>
  </div>

  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if filtered.length === 0}
    <div
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-border dark:bg-muted/30"
    >
      <p class="text-sm text-gray-600 dark:text-muted-foreground">No transactions match filters.</p>
    </div>
  {:else}
    <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/40">
          <tr>
            <th class="px-3 py-2 font-medium">Date</th>
            <th class="px-3 py-2 font-medium">Asset name</th>
            <th class="px-3 py-2 font-medium">Symbol</th>
            <th class="px-3 py-2 font-medium">Type</th>
            <th class="px-3 py-2 font-medium">Qty</th>
            <th class="px-3 py-2 font-medium">Unit</th>
            <th class="px-3 py-2 font-medium">Gross</th>
            <th class="px-3 py-2 font-medium">Fee</th>
            <th class="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as row (row.transactionId)}
            {@const ast = assetById.get(row.assetId)}
            <tr class="border-b border-gray-100 dark:border-border {!row.isDeleted ? '' : 'opacity-50'}">
              <td class="px-3 py-2 text-gray-800 dark:text-foreground">{row.tradeDate}</td>
              <td class="px-3 py-2 text-gray-800 dark:text-foreground">{ast?.name ?? '—'}</td>
              <td class="px-3 py-2">
                <a class="text-emerald-700 hover:underline dark:text-emerald-400" href={`/assets/${row.assetId}`}>
                  {ast?.symbol ?? row.assetId}
                </a>
              </td>
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                {row.transactionType}
                {row.adjustmentSide ? ` (${row.adjustmentSide})` : ''}
                {#if row.isDeleted}
                  <span class="text-xs text-red-600">deleted</span>
                {/if}
              </td>
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                {row.quantity ? formatMaskedNumber({ masked, decimalString: row.quantity, maximumFractionDigits: 8 }) : '—'}
              </td>
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                {row.unitPrice
                  ? formatMaskedMoney({ masked, decimalString: row.unitPrice, currencyCode: row.currencyCode })
                  : '—'}
              </td>
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                {row.grossAmount
                  ? formatMaskedMoney({ masked, decimalString: row.grossAmount, currencyCode: row.currencyCode })
                  : '—'}
              </td>
              <td class="px-3 py-2 text-gray-700 dark:text-muted-foreground">
                {row.feeAmount
                  ? formatMaskedMoney({ masked, decimalString: row.feeAmount, currencyCode: row.currencyCode })
                  : '—'}
              </td>
              <td class="px-3 py-2 text-right">
                {#if !row.isDeleted}
                  <button
                    type="button"
                    class="mr-2 text-emerald-700 hover:underline dark:text-emerald-400"
                    on:click={() => openEdit(row)}
                  >
                    Edit
                  </button>
                  <button type="button" class="text-red-600 hover:underline" on:click={() => (deleteTarget = row)}>Delete</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

{#if modal.kind !== 'closed'}
  <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" role="presentation">
    <div
      class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-border dark:bg-card"
      role="dialog"
      aria-modal="true"
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">
        {modal.kind === 'create' ? 'Add transaction' : 'Edit transaction'}
      </h2>
      {#if modal.kind === 'edit'}
        <p class="mt-1 text-xs text-gray-500 dark:text-muted-foreground">Type is fixed on edit ({modal.tx.transactionType}).</p>
      {/if}
      <form
        class="mt-4 space-y-3"
        on:submit|preventDefault={() => {
          void submitForm();
        }}
      >
        <label class="flex flex-col gap-1 text-sm">
          <span>Asset</span>
          <select
            class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
            bind:value={formAssetId}
            disabled={modal.kind === 'edit'}
          >
            {#each assets as a (a.assetId)}
              <option value={a.assetId}>{a.name} ({a.symbol}) · {a.currencyCode}{a.isActive ? '' : ' (archived)'}</option>
            {/each}
          </select>
        </label>
        {#if modal.kind === 'create'}
          <label class="flex flex-col gap-1 text-sm">
            <span>Type</span>
            <select
              class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
              bind:value={formType}
            >
              {#each transactionTypes as t (t)}
                <option value={t}>{t}</option>
              {/each}
            </select>
          </label>
        {/if}
        <label class="flex flex-col gap-1 text-sm">
          <span>Trade date</span>
          <input
            type="date"
            required
            class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
            bind:value={formTradeDate}
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span>Trade timestamp (optional ISO)</span>
          <input
            type="text"
            class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
            bind:value={formTradeTimestamp}
            placeholder="2026-04-13T12:00:00.000Z"
          />
        </label>
        {#if (modal.kind === 'create' && (formType === 'BUY' || formType === 'SELL')) || (modal.kind === 'edit' && (modal.tx.transactionType === 'BUY' || modal.tx.transactionType === 'SELL'))}
          <label class="flex flex-col gap-1 text-sm">
            <span>Quantity</span>
            <input
              type="text"
              class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
              bind:value={formQuantity}
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span>Unit price</span>
            <input
              type="text"
              class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
              bind:value={formUnitPrice}
            />
          </label>
        {/if}
        {#if (modal.kind === 'create' && (formType === 'DIVIDEND' || formType === 'INTEREST' || formType === 'FEE')) || (modal.kind === 'edit' && (modal.tx.transactionType === 'DIVIDEND' || modal.tx.transactionType === 'INTEREST' || modal.tx.transactionType === 'FEE'))}
          <label class="flex flex-col gap-1 text-sm">
            <span>Gross amount</span>
            <input
              type="text"
              class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
              bind:value={formGrossAmount}
            />
          </label>
        {/if}
        {#if (modal.kind === 'create' && formType === 'ADJUSTMENT') || (modal.kind === 'edit' && modal.tx.transactionType === 'ADJUSTMENT')}
          <label class="flex flex-col gap-1 text-sm">
            <span>Adjustment side</span>
            <select
              class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
              bind:value={formAdjustmentSide}
            >
              <option value="INCREASE">INCREASE</option>
              <option value="DECREASE">DECREASE</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span>Quantity</span>
            <input
              type="text"
              class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
              bind:value={formQuantity}
            />
          </label>
          {#if formAdjustmentSide === 'INCREASE'}
            <label class="flex flex-col gap-1 text-sm">
              <span>Unit price (required for increase)</span>
              <input
                type="text"
                class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
                bind:value={formUnitPrice}
              />
            </label>
          {/if}
        {/if}
        <label class="flex flex-col gap-1 text-sm">
          <span>Fee (optional)</span>
          <input
            type="text"
            class="rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
            bind:value={formFeeAmount}
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span>Notes {modal.kind === 'create' && formType === 'ADJUSTMENT' ? '(required)' : ''}</span>
          <textarea
            class="min-h-20 rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-border dark:bg-background dark:text-foreground"
            bind:value={formNotes}
          ></textarea>
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card dark:text-foreground"
            on:click={closeModal}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if deleteTarget}
  <div class="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" role="presentation">
    <div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-border dark:bg-card" role="dialog">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">Delete transaction?</h2>
      <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">
        This soft-deletes the row ({deleteTarget.transactionType} {deleteTarget.tradeDate}). Snapshots may need a rebuild.
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card"
          on:click={() => (deleteTarget = undefined)}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          disabled={isSaving}
          on:click={() => void confirmDelete()}
        >
          {isSaving ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
{/if}
