<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { PortfolioConfigDto } from '$lib/api/build-portfolio-config-put-body';
  import { apiClient } from '$lib/api/api-client-instance';
  import type { AnalysisRunSummary, AnalysisType } from '$lib/api/analysis';
  import { createAnalysisRun, listAnalysisRuns } from '$lib/api/analysis';
  import { ANALYSIS_TOOL_DEFINITIONS, formatAnalysisType } from '$lib/domain/analysis-tools';
  import { createAnalysisRunsFeed, type RealtimeConnectionStatus } from '$lib/realtime/analysis-runs-feed';
  import { toast } from '$lib/toast/toast';
  import {
    AlertTriangle,
    BarChart3,
    Briefcase,
    Calculator,
    CheckCircle2,
    Clock,
    Globe,
    LineChart,
    Loader2,
    Search,
    TrendingUp,
    X,
    XCircle,
  } from 'lucide-svelte';

  type PortfolioBuilderForm = {
    age: string;
    income: string;
    savings: string;
    goals: string;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  };

  const TOOL_PAYLOAD_PLACEHOLDERS: Record<string, Record<string, unknown>> = {
    'stock-screener': { sector: 'Technology', riskTolerance: 'moderate' },
    'dcf-valuation': { symbol: 'AAPL', growthAssumption: 'moderate' },
    'risk-assessment': {},
    'earnings-analysis': { symbol: 'NVDA' },
    'competitive-analysis': { sector: 'Technology' },
    'macro-impact': { concern: 'Inflation and higher rates' },
  };

  let activeDialog: AnalysisType | null = null;
  let isLoading = true;
  let isSubmitting = false;
  let runs: readonly AnalysisRunSummary[] = [];
  let realtimeStatus: RealtimeConnectionStatus = 'idle';
  let technicalSymbol = '';
  let technicalIncludePosition = true;
  let portfolioBuilderForm: PortfolioBuilderForm = {
    age: '',
    income: '',
    savings: '',
    goals: '',
    riskTolerance: 'moderate',
  };
  let closeFeed: (() => void) | undefined;

  function statusClass(status: AnalysisRunSummary['status']): string {
    if (status === 'completed') {
      return 'bg-green-100 text-green-700';
    }
    if (status === 'processing') {
      return 'bg-blue-100 text-blue-700';
    }
    if (status === 'failed') {
      return 'bg-red-100 text-red-700';
    }
    return 'bg-gray-100 text-gray-700';
  }

  function statusLabel(status: AnalysisRunSummary['status']): string {
    if (status === 'completed') return 'Completed';
    if (status === 'processing') return 'Processing';
    if (status === 'failed') return 'Failed';
    return 'Pending';
  }

  function openDialog(tool: AnalysisType): void {
    activeDialog = tool;
  }

  function closeDialog(): void {
    activeDialog = null;
  }

  function resolveIcon(id: string): typeof Search {
    if (id === 'calculator') return Calculator;
    if (id === 'alert') return AlertTriangle;
    if (id === 'trending') return TrendingUp;
    if (id === 'line') return LineChart;
    if (id === 'briefcase') return Briefcase;
    if (id === 'bar') return BarChart3;
    if (id === 'globe') return Globe;
    return Search;
  }

  function mergeRun(next: AnalysisRunSummary): void {
    const byId = new Map(runs.map((run) => [run.runId, run]));
    byId.set(next.runId, next);
    runs = Array.from(byId.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async function loadRuns(): Promise<void> {
    isLoading = true;
    try {
      runs = await listAnalysisRuns({ client: apiClient, limit: 30 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load analysis runs');
    } finally {
      isLoading = false;
    }
  }

  function calculateAgeFromDate(isoDate: string): number | null {
    const now = new Date();
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    let age = now.getUTCFullYear() - date.getUTCFullYear();
    const hasBirthdayPassed =
      now.getUTCMonth() > date.getUTCMonth() ||
      (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() >= date.getUTCDate());
    if (!hasBirthdayPassed) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  }

  function prefillPortfolioBuilderFromConfig(cfg: PortfolioConfigDto): void {
    const prefs = (cfg.preferences ?? {}) as Record<string, unknown>;
    const profile = ((prefs['profile'] ?? {}) as Record<string, unknown>) ?? {};
    const dob = typeof profile['dateOfBirth'] === 'string' ? profile['dateOfBirth'] : '';
    const age = dob.length > 0 ? calculateAgeFromDate(dob) : null;
    const incomeObj = (profile['monthlyInvestableIncome'] ?? {}) as Record<string, unknown>;
    const monthlyAmount = typeof incomeObj['amountWhole'] === 'number' ? incomeObj['amountWhole'] : null;
    const goals = Array.isArray(prefs['investmentGoals']) ? (prefs['investmentGoals'] as string[]) : [];
    const humanGoals = goals.length > 0 ? goals.map((goal) => goal.replaceAll('_', ' ').toLowerCase()).join(', ') : '';
    const risk = cfg.riskProfileType.toLowerCase();
    portfolioBuilderForm = {
      age: age === null ? '' : String(age),
      income: monthlyAmount === null ? '' : String(monthlyAmount * 12),
      savings: portfolioBuilderForm.savings,
      goals: humanGoals,
      riskTolerance:
        risk === 'aggressive' || risk === 'growth'
          ? 'aggressive'
          : risk === 'conservative'
            ? 'conservative'
            : 'moderate',
    };
  }

  async function loadPortfolioDefaults(): Promise<void> {
    try {
      const cfg = await apiClient.executeJson<PortfolioConfigDto>({ method: 'GET', path: '/portfolio/config' });
      prefillPortfolioBuilderFromConfig(cfg);
    } catch {
      // No-op: defaults remain empty if profile is not available yet.
    }
  }

  async function submitAnalysis(type: AnalysisType, parameters: Record<string, unknown>): Promise<void> {
    closeDialog();
    isSubmitting = true;
    try {
      const run = await createAnalysisRun({ client: apiClient, type, parameters });
      mergeRun(run);
      toast.success('Analysis started', { description: `${formatAnalysisType(type)} is now processing.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start analysis');
    } finally {
      isSubmitting = false;
    }
  }

  async function submitTechnicalAnalysis(): Promise<void> {
    const symbol = technicalSymbol.trim().toUpperCase();
    if (symbol.length === 0) {
      toast.error('Ticker symbol is required.');
      return;
    }
    await submitAnalysis('technical-analysis', { symbol, includePosition: technicalIncludePosition });
  }

  async function submitPortfolioBuilder(): Promise<void> {
    if (
      portfolioBuilderForm.age.trim().length === 0 ||
      portfolioBuilderForm.income.trim().length === 0 ||
      portfolioBuilderForm.savings.trim().length === 0 ||
      portfolioBuilderForm.goals.trim().length === 0
    ) {
      toast.error('Please complete all required fields.');
      return;
    }
    await submitAnalysis('portfolio-builder', {
      age: Number.parseInt(portfolioBuilderForm.age, 10),
      income: Number.parseFloat(portfolioBuilderForm.income),
      savings: Number.parseFloat(portfolioBuilderForm.savings),
      goals: portfolioBuilderForm.goals.trim(),
      riskTolerance: portfolioBuilderForm.riskTolerance,
    });
  }

  onMount(() => {
    void loadRuns();
    void loadPortfolioDefaults();
    const baseUrlRaw = import.meta.env.PUBLIC_API_BASE_URL;
    const apiBaseUrl = baseUrlRaw !== undefined && baseUrlRaw.length > 0 ? baseUrlRaw : window.location.origin;
    const feed = createAnalysisRunsFeed({
      apiBaseUrl,
      onRunEvent: (event) => {
        if (event.summary !== undefined) {
          mergeRun(event.summary);
        }
      },
      onConnectionStatus: (status) => {
        realtimeStatus = status;
      },
      onReconnect: async () => {
        await loadRuns();
      },
    });
    closeFeed = feed.close;
  });

  onDestroy(() => {
    if (closeFeed !== undefined) {
      closeFeed();
      closeFeed = undefined;
    }
  });
</script>

<svelte:head>
  <title>Explore · Badgers Investments</title>
</svelte:head>

<section class="space-y-8">
  <header class="space-y-1">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Investment Analysis Tools</h1>
      <span class="rounded-full px-2 py-0.5 text-xs font-medium {realtimeStatus === 'connected'
          ? 'bg-emerald-100 text-emerald-900'
          : realtimeStatus === 'degraded'
            ? 'bg-amber-100 text-amber-900'
            : 'bg-gray-100 text-gray-700'}">
        {realtimeStatus === 'connected'
          ? 'Live'
          : realtimeStatus === 'degraded'
            ? 'Degraded'
            : realtimeStatus === 'reconnecting' || realtimeStatus === 'connecting'
              ? 'Reconnecting'
              : 'Offline'}
      </span>
    </div>
    <p class="text-sm text-gray-600 dark:text-muted-foreground">
      Explore investment opportunities with professional analysis tools.
    </p>
  </header>

  <div>
    <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-foreground">Available Tools</h2>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {#each ANALYSIS_TOOL_DEFINITIONS as tool (tool.id)}
        <button
          type="button"
          class="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition dark:border-border dark:bg-card {tool.isAvailable
            ? 'hover:border-emerald-300 hover:shadow-md'
            : 'cursor-not-allowed opacity-70'}"
          disabled={!tool.isAvailable}
          on:click={() => openDialog(tool.id)}
        >
          <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-lg {tool.colorClassName}">
            <svelte:component this={resolveIcon(tool.icon)} class="h-6 w-6" />
          </div>
          <div class="mb-1 flex items-center justify-between gap-2">
            <h3 class="text-base font-semibold text-gray-900 dark:text-foreground">{tool.title}</h3>
            {#if !tool.isAvailable}
              <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-muted dark:text-muted-foreground">Coming soon</span>
            {/if}
          </div>
          <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">{tool.description}</p>
          <div class="mt-4">
            {#if tool.isAvailable}
              <span class="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                {tool.cta}
              </span>
            {:else}
              <span class="inline-flex w-full items-center justify-center rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-500 dark:bg-muted dark:text-muted-foreground">
                Not available yet
              </span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  </div>

  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">Recent Analyses</h2>
      <a
        href="/library"
        class="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-muted/60"
      >
        View All
      </a>
    </div>
    {#if isLoading}
      <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading analyses…</p>
    {:else if runs.length === 0}
      <div class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-5 dark:border-border dark:bg-muted/30">
        <p class="text-sm text-gray-600 dark:text-muted-foreground">No analyses yet. Start one from the tools above.</p>
      </div>
    {:else}
      <div class="divide-y overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card">
        {#each runs as run (run.runId)}
          <div class="p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 flex-1 items-start gap-3">
                {#if run.status === 'completed'}
                  <CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                {:else if run.status === 'processing'}
                  <Loader2 class="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" />
                {:else if run.status === 'failed'}
                  <XCircle class="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                {:else}
                  <Clock class="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                {/if}
                <div class="min-w-0 flex-1">
                  <div class="mb-1 flex items-center gap-2">
                    <h3 class="truncate text-sm font-semibold text-gray-900 dark:text-foreground">
                      {formatAnalysisType(run.type)}
                    </h3>
                    <span class="rounded-full px-2 py-0.5 text-xs font-medium {statusClass(run.status)}">
                      {statusLabel(run.status)}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-muted-foreground">{run.summary}</p>
                  <p class="mt-1 text-xs text-gray-500 dark:text-muted-foreground">
                    Started {new Date(run.createdAt).toLocaleString()}
                    {#if run.completedAt}
                      · Completed {new Date(run.completedAt).toLocaleString()}
                    {/if}
                  </p>
                </div>
              </div>
              {#if run.status === 'completed' && run.reportId}
                <a
                  href="/library?reportId={run.reportId}"
                  class="shrink-0 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-muted/60"
                >
                  View Report
                </a>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

{#if activeDialog !== null}
  <div
    class="fixed inset-0 z-40 bg-black/40"
    role="button"
    tabindex="0"
    aria-label="Close dialog"
    on:click={closeDialog}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        closeDialog();
      }
    }}
  ></div>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      class="w-full max-w-[425px] rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-border dark:bg-card"
      role="dialog"
      aria-modal="true"
    >
      <div class="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-foreground">
            {formatAnalysisType(activeDialog)}
          </h3>
          <p class="text-sm text-gray-600 dark:text-muted-foreground">
            {activeDialog === 'technical-analysis'
              ? 'Chart patterns, indicators, and technical signals.'
              : activeDialog === 'portfolio-builder'
                ? 'Build a custom portfolio from scratch based on your situation.'
                : 'Run this analysis with default placeholders for now.'}
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-muted"
          on:click={closeDialog}
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      {#if activeDialog === 'technical-analysis'}
        <form class="space-y-4" on:submit|preventDefault={() => void submitTechnicalAnalysis()}>
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-800 dark:text-foreground" for="technical-symbol">Ticker Symbol</label>
            <input
              id="technical-symbol"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-emerald-500 focus:outline-none dark:border-border dark:bg-background"
              placeholder="NVDA"
              bind:value={technicalSymbol}
              required
            />
          </div>
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-muted-foreground">
            <input type="checkbox" bind:checked={technicalIncludePosition} />
            Include my current position (if any)
          </label>
          <div class="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
            Includes moving averages, RSI, MACD, Bollinger Bands, support/resistance, and pattern recognition.
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border border-gray-300 px-3 py-2 text-sm" on:click={closeDialog}>Cancel</button>
            <button
              type="submit"
              class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Running…' : 'Run Analysis'}
            </button>
          </div>
        </form>
      {:else if activeDialog === 'portfolio-builder'}
        <form class="space-y-3" on:submit|preventDefault={() => void submitPortfolioBuilder()}>
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-800 dark:text-foreground" for="pb-age">Age</label>
            <input id="pb-age" type="number" min="18" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-background" bind:value={portfolioBuilderForm.age} required />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-800 dark:text-foreground" for="pb-income">Annual Income ($)</label>
            <input id="pb-income" type="number" min="0" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-background" bind:value={portfolioBuilderForm.income} required />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-800 dark:text-foreground" for="pb-savings">Available Savings ($)</label>
            <input id="pb-savings" type="number" min="0" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-background" bind:value={portfolioBuilderForm.savings} required />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-800 dark:text-foreground" for="pb-goals">Investment Goals</label>
            <textarea id="pb-goals" class="min-h-[84px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-background" bind:value={portfolioBuilderForm.goals} required></textarea>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-800 dark:text-foreground" for="pb-risk">Risk Tolerance</label>
            <select id="pb-risk" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-background" bind:value={portfolioBuilderForm.riskTolerance}>
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" class="rounded-md border border-gray-300 px-3 py-2 text-sm" on:click={closeDialog}>Cancel</button>
            <button
              type="submit"
              class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Building…' : 'Build Portfolio'}
            </button>
          </div>
        </form>
      {:else}
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-muted-foreground">
            This tool currently submits with default placeholder inputs while richer dialogs are delivered in follow-up tickets.
          </p>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border border-gray-300 px-3 py-2 text-sm" on:click={closeDialog}>Cancel</button>
            <button
              type="button"
              class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={isSubmitting}
              on:click={() => void submitAnalysis(activeDialog, TOOL_PAYLOAD_PLACEHOLDERS[activeDialog] ?? {})}
            >
              {isSubmitting ? 'Starting…' : 'Start Analysis'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
