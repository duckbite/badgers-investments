<svelte:head>
  <title>Recommendations · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import {
    listRecommendationRuns,
    runRecommendation,
    type RecommendationRunSummary,
  } from '$lib/api/recommendations';
  import { toast } from '$lib/toast/toast';

  let items: readonly RecommendationRunSummary[] = [];
  let isLoading: boolean = true;
  let isRunning: boolean = false;

  type QuickFilterId =
    | 'processing'
    | 'completed'
    | 'failed'
    | 'priority_high'
    | 'priority_medium'
    | 'priority_low'
    | 'source_rule'
    | 'source_ai'
    | 'actionable';

  const QUICK_FILTER_DEFS: readonly { readonly id: QuickFilterId; readonly label: string }[] = [
    { id: 'processing', label: 'Processing' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' },
    { id: 'priority_high', label: 'High priority' },
    { id: 'priority_medium', label: 'Medium priority' },
    { id: 'priority_low', label: 'Low priority' },
    { id: 'source_rule', label: 'Rule-based' },
    { id: 'source_ai', label: 'AI-generated' },
    { id: 'actionable', label: 'Requires action' },
  ];

  /** When empty, all runs are shown. Otherwise a run is shown if it matches any selected filter (OR). */
  let activeQuickFilters: QuickFilterId[] = [];

  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function strengthTier(score: string | null): 'high' | 'medium' | 'low' | null {
    if (score === null) {
      return null;
    }
    const n: number = Number.parseFloat(score);
    if (Number.isNaN(n)) {
      return null;
    }
    if (n >= 0.66) {
      return 'high';
    }
    if (n >= 0.33) {
      return 'medium';
    }
    return 'low';
  }

  function statusLabel(run: RecommendationRunSummary): string {
    if (run.runStatus === 'PROCESSING') {
      return 'Processing';
    }
    if (run.runStatus === 'FAILED') {
      return 'Failed';
    }
    if (run.runStatus === 'COMPLETED') {
      return 'Completed';
    }
    return run.runStatus;
  }

  function runCardDescription(run: RecommendationRunSummary): string {
    if (run.runStatus === 'PROCESSING') {
      return 'We are analysing your portfolio snapshot and rules. Open this run to watch progress — results appear when processing finishes.';
    }
    if (run.runStatus === 'FAILED') {
      return 'This run did not complete. Open for details or generate a new insight.';
    }
    if (run.runItemCount === 0) {
      return 'Open to view rule findings and recommendation lines for this snapshot.';
    }
    return `${run.runItemCount} recommendation line${run.runItemCount === 1 ? '' : 's'} · ${
      run.runActionableCount > 0
        ? `${run.runActionableCount} may need a trade or rebalance`
        : 'Review holds and watch items'
    }`;
  }

  function quickFilterMatches(run: RecommendationRunSummary, id: QuickFilterId): boolean {
    switch (id) {
      case 'processing':
        return run.runStatus === 'PROCESSING';
      case 'completed':
        return run.runStatus === 'COMPLETED';
      case 'failed':
        return run.runStatus === 'FAILED';
      case 'priority_high':
        return run.runStatus === 'COMPLETED' && strengthTier(run.runMaxStrengthScore) === 'high';
      case 'priority_medium':
        return run.runStatus === 'COMPLETED' && strengthTier(run.runMaxStrengthScore) === 'medium';
      case 'priority_low':
        return run.runStatus === 'COMPLETED' && strengthTier(run.runMaxStrengthScore) === 'low';
      case 'source_rule':
        return run.synthesisSource === 'DETERMINISTIC';
      case 'source_ai':
        return run.synthesisSource === 'AI';
      case 'actionable':
        return run.runActionableCount > 0;
      default:
        return false;
    }
  }

  function matchesQuickFilters(run: RecommendationRunSummary): boolean {
    if (activeQuickFilters.length === 0) {
      return true;
    }
    for (const id of activeQuickFilters) {
      if (quickFilterMatches(run, id)) {
        return true;
      }
    }
    return false;
  }

  function toggleQuickFilter(id: QuickFilterId): void {
    if (activeQuickFilters.includes(id)) {
      activeQuickFilters = activeQuickFilters.filter((x) => x !== id);
    } else {
      activeQuickFilters = [...activeQuickFilters, id];
    }
  }

  function clearQuickFilters(): void {
    activeQuickFilters = [];
  }

  $: filteredItems = items.filter(matchesQuickFilters);

  async function load(): Promise<void> {
    isLoading = true;
    try {
      items = await listRecommendationRuns({ client: apiClient, limit: 50 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      isLoading = false;
    }
  }

  function startPolling(): void {
    if (pollTimer !== undefined) {
      return;
    }
    pollTimer = setInterval(() => {
      void load();
    }, 3200);
  }

  function stopPolling(): void {
    if (pollTimer !== undefined) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  $: {
    const anyProcessing = items.some((r) => r.runStatus === 'PROCESSING');
    if (anyProcessing) {
      startPolling();
    } else {
      stopPolling();
    }
  }

  async function onGenerateInsights(): Promise<void> {
    isRunning = true;
    try {
      await runRecommendation({ client: apiClient, force: true });
      toast.success('Generating insights', {
        description:
          'A new run was queued. Keep this page open or run the worker (`pnpm --filter api recommendation-queue:process`) so it can finish.',
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Run failed');
    } finally {
      isRunning = false;
    }
  }

  onMount(() => {
    void load();
  });

  onDestroy(() => {
    stopPolling();
  });
</script>

<section class="space-y-6">
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Recommendations</h1>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        AI-powered and rule-based suggestions. New runs process in the background like analyses in Explore.
      </p>
    </div>
    <div class="flex shrink-0 items-center sm:items-start">
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        disabled={isLoading || isRunning}
        on:click={() => void onGenerateInsights()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
          aria-hidden="true"
        >
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
        </svg>
        {isRunning ? 'Starting…' : 'Generate new insights'}
      </button>
    </div>
  </header>

  <div class="flex flex-wrap items-center gap-2">
    {#each QUICK_FILTER_DEFS as def (def.id)}
      <button
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors {activeQuickFilters.includes(def.id)
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted/50'}"
        aria-pressed={activeQuickFilters.includes(def.id)}
        on:click={() => toggleQuickFilter(def.id)}
      >
        {def.label}
      </button>
    {/each}
    {#if activeQuickFilters.length > 0}
      <button
        type="button"
        class="text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
        on:click={clearQuickFilters}
      >
        Clear
      </button>
    {/if}
  </div>

  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if items.length === 0}
    <div
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-6 dark:border-border dark:bg-muted/30"
    >
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        No runs yet. Add holdings and snapshots, then generate new insights. Processing runs on the worker; run
        <code class="rounded bg-gray-100 px-1 dark:bg-muted">pnpm --filter api recommendation-queue:process</code>
        locally if needed.
      </p>
    </div>
  {:else if filteredItems.length === 0}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">No runs match these filters.</p>
  {:else}
    <ul class="space-y-3">
      {#each filteredItems as run (run.runId)}
        <li>
          <a
            href="/recommendations/{run.runId}"
            class="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-card"
          >
            <div class="flex flex-wrap items-start gap-3">
              <div class="mt-0.5 shrink-0" aria-hidden="true">
                {#if run.runStatus === 'PROCESSING'}
                  <span
                    class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600 dark:border-muted dark:border-t-emerald-400"
                  ></span>
                {:else if run.runStatus === 'FAILED'}
                  <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200"
                    >!</span
                  >
                {:else}
                  <span
                    class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold leading-none text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    >&#10003;</span
                  >
                {/if}
              </div>
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium {run.runStatus === 'PROCESSING'
                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100'
                      : run.runStatus === 'FAILED'
                        ? 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100'
                        : 'bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-100'}"
                  >
                    {statusLabel(run)}
                  </span>
                  {#if run.runStatus === 'COMPLETED'}
                    <span class="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-border dark:text-muted-foreground">
                      {run.synthesisSource === 'AI' ? 'AI-generated' : 'Rule-based'}
                    </span>
                    {#if strengthTier(run.runMaxStrengthScore)}
                      <span class="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-border dark:text-muted-foreground">
                        {strengthTier(run.runMaxStrengthScore)} priority
                      </span>
                    {/if}
                    {#if run.runActionableCount > 0}
                      <span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                        Requires action
                      </span>
                    {/if}
                  {/if}
                </div>
                <h2 class="text-base font-semibold text-gray-900 dark:text-foreground">
                  {run.portfolioLevelSummary}
                </h2>
                <p class="text-sm leading-relaxed text-gray-600 dark:text-muted-foreground">
                  {runCardDescription(run)}
                </p>
                <p class="text-xs text-gray-500 dark:text-muted-foreground">
                  {new Date(run.startedAt).toLocaleString()}
                  {#if run.completedAt}
                    · Completed {new Date(run.completedAt).toLocaleString()}
                  {/if}
                </p>
              </div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
