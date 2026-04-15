<svelte:head>
  <title>Recommendation run · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import {
    getRecommendationRunDetail,
    type RecommendationItemDto,
    type RecommendationRunDetail,
  } from '$lib/api/recommendations';
  import { toast } from '$lib/toast/toast';

  let detail: RecommendationRunDetail | undefined;
  let isLoading: boolean = true;

  type PriorityFilter = 'all' | 'high' | 'medium' | 'low';
  type SourceFilter = 'all' | 'ai' | 'rule';
  type ActionFilter = 'all' | 'actionable';

  let filterPriority: PriorityFilter = 'all';
  let filterSource: SourceFilter = 'all';
  let filterAction: ActionFilter = 'all';

  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function strengthTierFromScores(strength: string, confidence: string): 'high' | 'medium' | 'low' | null {
    const n: number = Number.parseFloat(strength);
    const c: number = Number.parseFloat(confidence);
    const score: number = Number.isNaN(n) ? (Number.isNaN(c) ? NaN : c) : n;
    if (Number.isNaN(score)) {
      return null;
    }
    if (score >= 0.66) {
      return 'high';
    }
    if (score >= 0.33) {
      return 'medium';
    }
    return 'low';
  }

  function proposedAction(it: RecommendationItemDto): string | null {
    const t = it.recommendationType;
    if (t === 'BUY') {
      return 'Consider buying to align with your targets and risk settings (execution via connected brokers is not available yet).';
    }
    if (t === 'SELL') {
      return 'Consider trimming or exiting this position in line with the rationale (execution via connected brokers is not available yet).';
    }
    if (t === 'WATCH') {
      return 'Monitor this holding and revisit after prices or fundamentals move.';
    }
    return null;
  }

  function isActionableItem(it: RecommendationItemDto): boolean {
    return it.recommendationType === 'BUY' || it.recommendationType === 'SELL';
  }

  function itemMatchesFilters(it: RecommendationItemDto): boolean {
    if (filterSource === 'ai' && it.source !== 'AI') {
      return false;
    }
    if (filterSource === 'rule' && it.source !== 'DETERMINISTIC') {
      return false;
    }
    if (filterAction === 'actionable' && !isActionableItem(it)) {
      return false;
    }
    if (filterPriority !== 'all') {
      const tier = strengthTierFromScores(it.strengthScore, it.confidenceScore);
      if (tier !== filterPriority) {
        return false;
      }
    }
    return true;
  }

  $: filteredItems = detail?.items.filter(itemMatchesFilters) ?? [];

  async function loadRun(input: { readonly runId: string }): Promise<void> {
    if (input.runId.length === 0) {
      return;
    }
    isLoading = true;
    try {
      detail = await getRecommendationRunDetail({ client: apiClient, runId: input.runId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load run');
      detail = undefined;
    } finally {
      isLoading = false;
    }
  }

  function startPolling(runId: string): void {
    if (pollTimer !== undefined) {
      return;
    }
    pollTimer = setInterval(() => {
      void loadRun({ runId });
    }, 3200);
  }

  function stopPolling(): void {
    if (pollTimer !== undefined) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  $: {
    const runId = $page.params.runId ?? '';
    if (detail?.runStatus === 'PROCESSING' && runId.length > 0) {
      startPolling(runId);
    } else {
      stopPolling();
    }
  }

  afterNavigate(() => {
    const runId: string = $page.params.runId ?? '';
    void loadRun({ runId });
  });

  onDestroy(() => {
    stopPolling();
  });
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-center gap-3">
    <a
      href="/recommendations"
      class="text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
    >
      ← All recommendations
    </a>
  </div>

  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if detail === undefined}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Run not found.</p>
  {:else}
    <header class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium {detail.runStatus === 'PROCESSING'
            ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100'
            : detail.runStatus === 'FAILED'
              ? 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100'
              : 'bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-100'}"
        >
          {detail.runStatus === 'PROCESSING'
            ? 'Processing'
            : detail.runStatus === 'FAILED'
              ? 'Failed'
              : 'Completed'}
        </span>
        {#if detail.runStatus === 'COMPLETED'}
          <span class="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-border dark:text-muted-foreground">
            {detail.synthesisSource === 'AI' ? 'AI-generated' : 'Rule-based'}
          </span>
        {/if}
      </div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">{detail.portfolioLevelSummary}</h1>
      {#if detail.runStatus === 'PROCESSING'}
        <p class="text-sm leading-relaxed text-gray-600 dark:text-muted-foreground">
          We are generating recommendations from your snapshot and rules. This page refreshes automatically. Run the worker with
          <code class="rounded bg-gray-100 px-1 dark:bg-muted">pnpm --filter api recommendation-queue:process</code>
          if nothing completes.
        </p>
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-muted-foreground">
          <span
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600 dark:border-muted dark:border-t-emerald-400"
            aria-hidden="true"
          ></span>
          Processing…
        </div>
      {:else}
        <p class="text-sm text-gray-600 dark:text-muted-foreground">
          {new Date(detail.startedAt).toLocaleString()}
          {#if detail.completedAt}
            · Completed {new Date(detail.completedAt).toLocaleString()}
          {/if}
          · AI: {detail.aiStatus}
          {#if detail.aiProvider}
            · {detail.aiProvider}{#if detail.aiModel}
              / {detail.aiModel}{/if}
          {/if}
        </p>
      {/if}
    </header>

    {#if detail.runStatus === 'FAILED'}
      <div
        class="rounded-lg border border-red-200 bg-red-50/90 p-3 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
        role="alert"
      >
        <strong class="font-medium">This run did not complete.</strong>
        {#if detail.aiError}
          <span class="mt-1 block">{detail.aiError}</span>
        {:else}
          <span class="mt-1 block">Generate a new insight from the list, or check worker logs.</span>
        {/if}
      </div>
    {:else if detail.aiStatus === 'SKIPPED' && detail.runStatus === 'COMPLETED'}
      <div
        class="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
        role="status"
      >
        <strong class="font-medium">AI was not used for this run.</strong>
        Add an API key under Settings → AI. The API server must have <code class="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">API_AI_SETTINGS_SECRET</code>
        set to the same value as when you saved the key, otherwise the key cannot be decrypted.
      </div>
    {:else if detail.aiStatus === 'FAILED' && detail.runStatus === 'COMPLETED'}
      <div
        class="rounded-lg border border-red-200 bg-red-50/90 p-3 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
        role="alert"
      >
        <strong class="font-medium">AI synthesis failed.</strong>
        {#if detail.aiError}
          <span class="mt-1 block">{detail.aiError}</span>
        {:else}
          <span class="mt-1 block">Check the provider status, model id, and API key; then run again.</span>
        {/if}
      </div>
    {/if}

    {#if detail.runStatus !== 'PROCESSING'}
      <div class="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-border">
        <span class="w-full text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Filter items</span>
        <div class="flex flex-wrap gap-2">
          {#each ['all', 'high', 'medium', 'low'] as p (p)}
            <button
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium {filterPriority === p
                ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-gray-200 bg-white dark:border-border dark:bg-card'}"
              on:click={() => (filterPriority = p as PriorityFilter)}
            >
              {p === 'all' ? 'All priorities' : p[0].toUpperCase() + p.slice(1)}
            </button>
          {/each}
        </div>
        <div class="flex flex-wrap gap-2">
          {#each ['all', 'rule', 'ai'] as src (src)}
            <button
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium {filterSource === src
                ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-gray-200 bg-white dark:border-border dark:bg-card'}"
              on:click={() => (filterSource = src as SourceFilter)}
            >
              {src === 'all' ? 'All sources' : src === 'ai' ? 'AI-generated' : 'Rule-based'}
            </button>
          {/each}
        </div>
        <div class="flex flex-wrap gap-2">
          {#each ['all', 'actionable'] as a (a)}
            <button
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium {filterAction === a
                ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-gray-200 bg-white dark:border-border dark:bg-card'}"
              on:click={() => (filterAction = a as ActionFilter)}
            >
              {a === 'all' ? 'All items' : 'Requires action'}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Rule findings</h2>
        {#if detail.runStatus === 'PROCESSING'}
          <p class="text-sm text-gray-600 dark:text-muted-foreground">Findings appear when processing finishes.</p>
        {:else if detail.findings.length === 0}
          <p class="text-sm text-gray-600 dark:text-muted-foreground">No findings triggered.</p>
        {:else}
          <ul class="space-y-2">
            {#each detail.findings as f (f.findingId)}
              <li class="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-border dark:bg-card">
                <div class="font-medium text-gray-900 dark:text-foreground">
                  {f.ruleCode}
                  <span class="text-xs font-normal text-gray-500 dark:text-muted-foreground">· {f.severity}</span>
                </div>
                <p class="mt-1 text-gray-700 dark:text-foreground/90">{f.message}</p>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Recommendations</h2>
        {#if detail.runStatus === 'PROCESSING'}
          <p class="text-sm text-gray-600 dark:text-muted-foreground">Recommendation lines appear when processing finishes.</p>
        {:else if filteredItems.length === 0}
          <p class="text-sm text-gray-600 dark:text-muted-foreground">No items match these filters.</p>
        {:else}
          <ul class="space-y-3">
            {#each filteredItems as it (it.itemId)}
              <li class="rounded-xl border border-gray-200 bg-white p-4 text-sm dark:border-border dark:bg-card">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div class="font-semibold text-gray-900 dark:text-foreground">{it.headline}</div>
                    <div class="mt-1 flex flex-wrap gap-2">
                      <span class="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-border dark:text-muted-foreground">
                        {it.recommendationType}
                      </span>
                      <span class="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-border dark:text-muted-foreground">
                        {it.source === 'AI' ? 'AI-generated' : 'Rule-based'}
                      </span>
                      {#if strengthTierFromScores(it.strengthScore, it.confidenceScore)}
                        <span class="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-border dark:text-muted-foreground">
                          {strengthTierFromScores(it.strengthScore, it.confidenceScore)} priority
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
                <p class="mt-2 leading-relaxed text-gray-700 dark:text-foreground/90">{it.rationale}</p>
                {#if it.assumptions}
                  <p class="mt-2 text-xs text-gray-500 dark:text-muted-foreground">{it.assumptions}</p>
                {/if}
                {#if proposedAction(it)}
                  <div class="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/25">
                    <p class="text-xs font-medium uppercase tracking-wide text-emerald-900 dark:text-emerald-200">Suggested next step</p>
                    <p class="mt-1 text-sm text-emerald-950 dark:text-emerald-100">{proposedAction(it)}</p>
                    <button
                      type="button"
                      disabled
                      class="mt-3 w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white opacity-50 dark:bg-emerald-600"
                      title="Broker execution is not available yet."
                    >
                      Take action
                    </button>
                  </div>
                {/if}
                <div class="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                  Strength {it.strengthScore} · Confidence {it.confidenceScore} · {it.scopeType}
                  {#if it.assetId}
                    · {it.assetId.slice(0, 8)}…
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</section>
