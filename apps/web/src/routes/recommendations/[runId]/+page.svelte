<svelte:head>
  <title>Recommendation run · Badgers Investments</title>
</svelte:head>

<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiClient } from '$lib/api/api-client-instance';
  import { getRecommendationRunDetail, type RecommendationRunDetail } from '$lib/api/recommendations';
  import { toast } from '$lib/toast/toast';

  let detail: RecommendationRunDetail | undefined;
  let isLoading: boolean = true;

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

  afterNavigate(() => {
    const runId: string = $page.params.runId ?? '';
    void loadRun({ runId });
  });
</script>

<section class="space-y-4">
  <div class="flex flex-wrap items-center gap-3">
    <a
      href="/recommendations"
      class="text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
    >
      ← All runs
    </a>
  </div>

  {#if isLoading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading…</p>
  {:else if detail === undefined}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Run not found.</p>
  {:else}
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">{detail.portfolioLevelSummary}</h1>
      <p class="text-sm text-gray-600 dark:text-muted-foreground">
        {new Date(detail.startedAt).toLocaleString()} · {detail.synthesisSource}
        · AI: {detail.aiStatus}
        {#if detail.aiProvider}
          · {detail.aiProvider}{#if detail.aiModel}
            / {detail.aiModel}{/if}
        {/if}
      </p>
    </header>

    {#if detail.aiStatus === 'SKIPPED'}
      <div
        class="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
        role="status"
      >
        <strong class="font-medium">AI was not used for this run.</strong>
        Add an API key under Settings → AI. The API server must have <code class="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">API_AI_SETTINGS_SECRET</code>
        set to the same value as when you saved the key, otherwise the key cannot be decrypted.
      </div>
    {:else if detail.aiStatus === 'FAILED'}
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

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">Rule findings</h2>
        {#if detail.findings.length === 0}
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
        <ul class="space-y-2">
          {#each detail.items as it (it.itemId)}
            <li class="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-border dark:bg-card">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <div class="font-medium text-gray-900 dark:text-foreground">{it.headline}</div>
                <div class="text-xs text-gray-500 dark:text-muted-foreground">
                  {it.recommendationType} · {it.scopeType}
                  {#if it.assetId}
                    · {it.assetId.slice(0, 8)}…
                  {/if}
                </div>
              </div>
              <p class="mt-1 text-gray-700 dark:text-foreground/90">{it.rationale}</p>
              {#if it.assumptions}
                <p class="mt-1 text-xs text-gray-500 dark:text-muted-foreground">{it.assumptions}</p>
              {/if}
              <div class="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                Strength {it.strengthScore} · Confidence {it.confidenceScore} · {it.source}
              </div>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</section>
