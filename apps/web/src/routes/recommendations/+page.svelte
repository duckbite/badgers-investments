<svelte:head>
  <title>Recommendations · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { apiClient } from '$lib/api/api-client-instance';
  import {
    cancelRecommendationRun,
    deleteRecommendationRun,
    listRecommendationRuns,
    runRecommendation,
    type RecommendationRunSummary,
  } from '$lib/api/recommendations';
  import {
    createRecommendationRunsFeed,
    type RealtimeConnectionStatus,
    type RealtimeRecommendationRunEvent,
  } from '$lib/realtime/recommendation-runs-feed';
  import { toast } from '$lib/toast/toast';

  let items: readonly RecommendationRunSummary[] = [];
  let isLoading: boolean = true;
  let isRunning: boolean = false;
  let openRunMenuId: string | null = null;
  let actionRunId: string | null = null;

  type QuickFilterId =
    | 'processing'
    | 'completed'
    | 'failed'
    | 'timeout'
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
    { id: 'timeout', label: 'Timeout' },
    { id: 'priority_high', label: 'High priority' },
    { id: 'priority_medium', label: 'Medium priority' },
    { id: 'priority_low', label: 'Low priority' },
    { id: 'source_rule', label: 'Rule-based' },
    { id: 'source_ai', label: 'AI-generated' },
    { id: 'actionable', label: 'Requires action' },
  ];

  /** When empty, all runs are shown. Otherwise a run is shown if it matches any selected filter (OR). */
  let activeQuickFilters: QuickFilterId[] = [];

  let realtimeConnectionStatus: RealtimeConnectionStatus = 'idle';
  let closeRealtimeFeed: (() => void) | undefined;
  const runEventUpdatedAtByRunId: Map<string, number> = new Map<string, number>();

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
    if (run.runStatus === 'TIMEOUT') {
      return 'Timeout';
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
    if (run.runStatus === 'TIMEOUT') {
      return 'This run timed out after 10 minutes and was stopped automatically.';
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
      case 'timeout':
        return run.runStatus === 'TIMEOUT';
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

  function matchesQuickFilters(run: RecommendationRunSummary, selectedFilters: readonly QuickFilterId[]): boolean {
    if (selectedFilters.length === 0) {
      return true;
    }
    for (const id of selectedFilters) {
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

  $: filteredItems = items.filter((run) => matchesQuickFilters(run, activeQuickFilters));

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

  function upsertRunFromEvent(event: RealtimeRecommendationRunEvent): void {
    const eventTimestamp: number = Date.parse(event.occurredAt);
    const safeTimestamp: number = Number.isNaN(eventTimestamp) ? Date.now() : eventTimestamp;
    const previousTimestamp: number = runEventUpdatedAtByRunId.get(event.runId) ?? 0;
    if (safeTimestamp < previousTimestamp) {
      return;
    }
    runEventUpdatedAtByRunId.set(event.runId, safeTimestamp);
    if (event.summary !== undefined) {
      const summary = event.summary as RecommendationRunSummary;
      const nextById: Map<string, RecommendationRunSummary> = new Map(items.map((run) => [run.runId, run]));
      nextById.set(summary.runId, summary);
      items = Array.from(nextById.values()).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      return;
    }
    const existing: RecommendationRunSummary | undefined = items.find((run) => run.runId === event.runId);
    if (existing === undefined) {
      return;
    }
    const nextSummary: RecommendationRunSummary = { ...existing, runStatus: event.status };
    items = items.map((run) => (run.runId === event.runId ? nextSummary : run));
  }

  function connectionStatusLabel(status: RealtimeConnectionStatus): string {
    if (status === 'connected') {
      return 'Live';
    }
    if (status === 'connecting' || status === 'reconnecting') {
      return 'Reconnecting';
    }
    if (status === 'degraded') {
      return 'Degraded';
    }
    return 'Offline';
  }

  function connectionStatusClass(status: RealtimeConnectionStatus): string {
    if (status === 'connected') {
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
    }
    if (status === 'degraded') {
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-muted-foreground';
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

  function isRunActionPending(runId: string): boolean {
    return actionRunId === runId;
  }

  async function onCancelRun(runId: string): Promise<void> {
    actionRunId = runId;
    try {
      const result = await cancelRecommendationRun({ client: apiClient, runId });
      if (!result.cancelled) {
        toast.error('Run is no longer running.');
      } else {
        toast.success('Run cancelled.');
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel run');
    } finally {
      actionRunId = null;
      openRunMenuId = null;
    }
  }

  async function onDeleteRun(runId: string): Promise<void> {
    actionRunId = runId;
    try {
      const result = await deleteRecommendationRun({ client: apiClient, runId });
      if (!result.deleted) {
        toast.error('Cannot delete a running run.');
      } else {
        toast.success('Run deleted.');
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete run');
    } finally {
      actionRunId = null;
      openRunMenuId = null;
    }
  }

  onMount(() => {
    void load();
    const baseUrlRaw: string | undefined = import.meta.env.PUBLIC_API_BASE_URL;
    const apiBaseUrl: string = baseUrlRaw !== undefined && baseUrlRaw.length > 0 ? baseUrlRaw : window.location.origin;
    const feed = createRecommendationRunsFeed({
      apiBaseUrl,
      onRecommendationEvent: (event) => {
        upsertRunFromEvent(event);
      },
      onConnectionStatus: (status) => {
        realtimeConnectionStatus = status;
      },
      onReconnect: async () => {
        await load();
      },
    });
    closeRealtimeFeed = feed.close;
  });

  onDestroy(() => {
    if (closeRealtimeFeed !== undefined) {
      closeRealtimeFeed();
      closeRealtimeFeed = undefined;
    }
  });
</script>

<section class="space-y-6">
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div class="space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Recommendations</h1>
        <span class="rounded-full px-2 py-0.5 text-xs font-medium {connectionStatusClass(realtimeConnectionStatus)}">
          {connectionStatusLabel(realtimeConnectionStatus)}
        </span>
      </div>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        AI-powered and rule-based suggestions. Run updates stream over WebSocket without periodic refresh loops.
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2 sm:items-start">
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
          <div class="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-card">
            <div class="absolute right-4 top-4">
              <div class="relative">
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted/50"
                  aria-label="Run actions"
                  aria-haspopup="menu"
                  aria-expanded={openRunMenuId === run.runId}
                  disabled={isRunActionPending(run.runId)}
                  on:click={() => {
                    openRunMenuId = openRunMenuId === run.runId ? null : run.runId;
                  }}
                >
                  &#8942;
                </button>
                {#if openRunMenuId === run.runId}
                  <div
                    class="absolute right-0 z-20 mt-2 min-w-[160px] rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-border dark:bg-card"
                    role="menu"
                  >
                    {#if run.runStatus === 'PROCESSING'}
                      <button
                        type="button"
                        class="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:text-foreground dark:hover:bg-muted/50"
                        role="menuitem"
                        disabled={isRunActionPending(run.runId)}
                        on:click={() => void onCancelRun(run.runId)}
                      >
                        {isRunActionPending(run.runId) ? 'Cancelling…' : 'Cancel run'}
                      </button>
                    {:else}
                      <button
                        type="button"
                        class="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30"
                        role="menuitem"
                        disabled={isRunActionPending(run.runId)}
                        on:click={() => void onDeleteRun(run.runId)}
                      >
                        {isRunActionPending(run.runId) ? 'Deleting…' : 'Delete'}
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            <div class="flex flex-wrap items-start gap-3">
              <div class="mt-0.5 shrink-0" aria-hidden="true">
                {#if run.runStatus === 'PROCESSING'}
                  <span
                    class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600 dark:border-muted dark:border-t-emerald-400"
                  ></span>
                {:else if run.runStatus === 'FAILED' || run.runStatus === 'TIMEOUT'}
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
              <div class="min-w-0 flex-1 space-y-2 pr-10">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium {run.runStatus === 'PROCESSING'
                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100'
                      : run.runStatus === 'FAILED' || run.runStatus === 'TIMEOUT'
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
                <a href="/recommendations/{run.runId}" class="text-base font-semibold text-gray-900 hover:underline dark:text-foreground">
                  {run.portfolioLevelSummary}
                </a>
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
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
