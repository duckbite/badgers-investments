<svelte:head>
  <title>Recommendations · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
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
  /** When true, server may return an existing run if inputs are unchanged (saves time / API usage). */
  let reuseIfUnchanged: boolean = false;

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

  async function onRunNow(): Promise<void> {
    isRunning = true;
    try {
      const result = await runRecommendation({ client: apiClient, force: !reuseIfUnchanged });
      if (result.deduped) {
        toast.success('Using existing run', {
          description:
            'This portfolio state was already analysed with the same inputs. Uncheck “Reuse previous result…” for a fresh run.',
        });
      } else {
        toast.success('Recommendation run completed.');
      }
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
</script>

<section class="space-y-4">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Recommendations</h1>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        Deterministic rules and scoring, with optional AI synthesis when API keys are configured in Settings.
      </p>
    </div>
    <div class="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-muted-foreground">
        <input type="checkbox" bind:checked={reuseIfUnchanged} class="rounded border-gray-300 dark:border-border" />
        Reuse previous result if inputs are unchanged
      </label>
      <button
        type="button"
        class="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        disabled={isLoading || isRunning}
        on:click={() => void onRunNow()}
      >
        {isRunning ? 'Running…' : 'Run recommendation'}
      </button>
    </div>
  </header>

  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if items.length === 0}
    <div
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-border dark:bg-muted/30"
    >
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        No runs yet. Use “Run recommendation” after snapshots exist for your portfolio.
      </p>
    </div>
  {:else}
    <ul class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 dark:divide-border dark:border-border">
      {#each items as run (run.runId)}
        <li class="bg-white dark:bg-card">
          <a
            href="/recommendations/{run.runId}"
            class="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-muted/40"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-medium text-gray-900 dark:text-foreground">{run.portfolioLevelSummary}</div>
              <div class="text-xs text-gray-500 dark:text-muted-foreground">
                {new Date(run.startedAt).toLocaleString()} · {run.synthesisSource}
                {#if run.aiStatus === 'FAILED'}
                  <span class="text-amber-700 dark:text-amber-400">· AI failed (rules only)</span>
                {:else if run.aiStatus === 'SKIPPED'}
                  <span class="text-gray-600 dark:text-muted-foreground">· AI skipped</span>
                {/if}
              </div>
            </div>
            <div class="mt-1 truncate text-xs text-gray-500 dark:text-muted-foreground">
              {run.runId}
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
