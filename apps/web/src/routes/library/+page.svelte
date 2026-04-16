<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { apiClient } from '$lib/api/api-client-instance';
  import type { AnalysisReportDetail, AnalysisReportSummary, AnalysisType } from '$lib/api/analysis';
  import { exportAnalysisReport, getAnalysisReport, listAnalysisReports } from '$lib/api/analysis';
  import { formatAnalysisType } from '$lib/domain/analysis-tools';
  import { toast } from '$lib/toast/toast';
  import { Clock3, Download, FileText, Search, User, X } from 'lucide-svelte';

  let activeScope: 'my' | 'all' = 'my';
  let activeType: AnalysisType | 'all' = 'all';
  let searchQuery = '';
  let loading = true;
  let reports: readonly AnalysisReportSummary[] = [];
  let selectedReport: AnalysisReportDetail | null = null;
  let selectedReportHtml = '';
  let selectedReportId: string | null = null;
  let isOpening = false;
  let isExporting = false;

  const FILTER_OPTIONS: readonly { readonly id: AnalysisType | 'all'; readonly label: string }[] = [
    { id: 'all', label: 'All Report Types' },
    { id: 'stock-screener', label: 'Stock Screener' },
    { id: 'dcf-valuation', label: 'DCF Valuation' },
    { id: 'risk-assessment', label: 'Risk Assessment' },
    { id: 'earnings-analysis', label: 'Earnings Analysis' },
    { id: 'technical-analysis', label: 'Technical Analysis' },
    { id: 'portfolio-builder', label: 'Portfolio Builder' },
    { id: 'competitive-analysis', label: 'Competitive Analysis' },
    { id: 'macro-impact', label: 'Macro Impact' },
  ];

  function reportTypeClass(type: AnalysisType): string {
    if (type === 'stock-screener') return 'bg-blue-100 text-blue-700';
    if (type === 'dcf-valuation') return 'bg-green-100 text-green-700';
    if (type === 'risk-assessment') return 'bg-orange-100 text-orange-700';
    if (type === 'earnings-analysis') return 'bg-purple-100 text-purple-700';
    if (type === 'technical-analysis') return 'bg-indigo-100 text-indigo-700';
    if (type === 'portfolio-builder') return 'bg-emerald-100 text-emerald-700';
    if (type === 'competitive-analysis') return 'bg-cyan-100 text-cyan-700';
    return 'bg-pink-100 text-pink-700';
  }

  async function loadReports(): Promise<void> {
    loading = true;
    try {
      reports = await listAnalysisReports({
        client: apiClient,
        limit: 100,
        scope: activeScope,
        type: activeType,
        query: searchQuery.trim().length > 0 ? searchQuery.trim() : undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load reports');
    } finally {
      loading = false;
    }
  }

  async function openReport(reportId: string): Promise<void> {
    selectedReportId = reportId;
    isOpening = true;
    try {
      selectedReport = await getAnalysisReport({ client: apiClient, reportId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load report');
    } finally {
      isOpening = false;
    }
  }

  function closeReport(): void {
    selectedReport = null;
    selectedReportId = null;
    selectedReportHtml = '';
  }

  function downloadTextFile(input: { readonly fileName: string; readonly content: string }): void {
    const blob = new Blob([input.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = input.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function exportReport(reportId: string): Promise<void> {
    isExporting = true;
    try {
      const data = await exportAnalysisReport({ client: apiClient, reportId });
      downloadTextFile({ fileName: data.fileName, content: data.content });
      toast.success('Report exported');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export report');
    } finally {
      isExporting = false;
    }
  }

  $: if (activeScope !== undefined || activeType !== undefined || searchQuery !== undefined) {
    // trigger via explicit handlers only
  }

  onMount(() => {
    void loadReports();
    const queryReportId = $page.url.searchParams.get('reportId');
    if (queryReportId !== null && queryReportId.length > 0) {
      void openReport(queryReportId);
    }
  });

  $: if (selectedReport !== null) {
    const rawHtml = marked.parse(selectedReport.markdownBody);
    const unsafeHtml = typeof rawHtml === 'string' ? rawHtml : '';
    selectedReportHtml = DOMPurify.sanitize(unsafeHtml, { USE_PROFILES: { html: true } });
  }
</script>

<svelte:head>
  <title>Library · Badgers Investments</title>
</svelte:head>

<section class="space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Report Library</h1>
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Access generated investment analysis reports.</p>
  </header>

  <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
    <div class="flex flex-col gap-3 md:flex-row md:items-center">
      <div class="relative flex-1">
        <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          class="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-border dark:bg-background"
          placeholder="Search reports..."
          bind:value={searchQuery}
          on:keydown={(event) => {
            if (event.key === 'Enter') {
              void loadReports();
            }
          }}
        />
      </div>
      <select
        class="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-background"
        bind:value={activeType}
        on:change={() => void loadReports()}
      >
        {#each FILTER_OPTIONS as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
      <div class="inline-flex rounded-md border border-gray-300 p-0.5 dark:border-border">
        <button
          type="button"
          class="rounded px-3 py-1.5 text-sm {activeScope === 'my' ? 'bg-emerald-600 text-white' : 'text-gray-700 dark:text-foreground'}"
          on:click={() => {
            activeScope = 'my';
            void loadReports();
          }}
        >
          My reports
        </button>
        <button
          type="button"
          class="rounded px-3 py-1.5 text-sm {activeScope === 'all' ? 'bg-emerald-600 text-white' : 'text-gray-700 dark:text-foreground'}"
          on:click={() => {
            activeScope = 'all';
            void loadReports();
          }}
        >
          All reports
        </button>
      </div>
    </div>
  </div>

  {#if loading}
    <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading reports…</p>
  {:else if reports.length === 0}
    <div class="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center dark:border-border dark:bg-muted/30">
      <FileText class="mx-auto mb-3 h-10 w-10 text-gray-400" />
      <p class="text-sm font-medium text-gray-700 dark:text-foreground">No reports found</p>
      <p class="mt-1 text-sm text-gray-500 dark:text-muted-foreground">
        {searchQuery.trim().length > 0 || activeType !== 'all'
          ? 'Try adjusting your filters.'
          : activeScope === 'my'
            ? 'Run analyses from Explore to populate your library.'
            : 'No shared reports are available yet.'}
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {#each reports as report (report.reportId)}
        <article class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
          <div class="mb-2 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="truncate text-base font-semibold text-gray-900 dark:text-foreground">{report.title}</h2>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span class="rounded-full px-2 py-0.5 font-medium {reportTypeClass(report.type)}">
                  {formatAnalysisType(report.type)}
                </span>
                <span class="inline-flex items-center gap-1 text-gray-500 dark:text-muted-foreground">
                  <User class="h-3.5 w-3.5" />
                  {report.createdBy}
                </span>
                <span class="inline-flex items-center gap-1 text-gray-500 dark:text-muted-foreground">
                  <Clock3 class="h-3.5 w-3.5" />
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <p class="mb-3 text-sm text-gray-600 dark:text-muted-foreground">{report.summary}</p>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              on:click={() => void openReport(report.reportId)}
            >
              View Report
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-muted/60"
              on:click={() => void exportReport(report.reportId)}
              disabled={isExporting}
            >
              <Download class="h-3.5 w-3.5" />
              Export
            </button>
            <button
              type="button"
              class="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-500 dark:border-border dark:text-muted-foreground"
              disabled
            >
              Share
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

{#if selectedReportId !== null}
  <div
    class="fixed inset-0 z-40 bg-black/40"
    role="button"
    tabindex="0"
    aria-label="Close report viewer"
    on:click={closeReport}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        closeReport();
      }
    }}
  ></div>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-border dark:bg-card">
      <div class="flex items-start justify-between border-b border-gray-200 p-4 dark:border-border">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-foreground">
            {selectedReport?.title ?? 'Loading report...'}
          </h3>
          {#if selectedReport !== null}
            <p class="text-sm text-gray-600 dark:text-muted-foreground">
              {formatAnalysisType(selectedReport.type)} · {new Date(selectedReport.createdAt).toLocaleString()}
            </p>
          {/if}
        </div>
        <button type="button" class="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-muted" on:click={closeReport}>
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="overflow-auto p-4">
        {#if isOpening || selectedReport === null}
          <p class="text-sm text-gray-600 dark:text-muted-foreground">Loading report content…</p>
        {:else}
          <article class="prose max-w-none text-[15px] leading-7 text-gray-700 dark:prose-invert dark:text-muted-foreground [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-semibold [&_p]:my-4 [&_p]:leading-8 [&_ul]:my-4 [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:pl-6 [&_li]:my-1.5 [&_hr]:my-7 [&_blockquote]:my-5 [&_blockquote]:rounded-md [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:bg-gray-50 [&_blockquote]:px-4 [&_blockquote]:py-2 dark:[&_blockquote]:border-border dark:[&_blockquote]:bg-muted/40 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:border [&_:not(pre)>code]:border-gray-200 [&_:not(pre)>code]:bg-gray-100 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:text-gray-800 dark:[&_:not(pre)>code]:border-border dark:[&_:not(pre)>code]:bg-muted/70 dark:[&_:not(pre)>code]:text-gray-100 [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-slate-300 [&_pre]:bg-slate-100 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-7 [&_pre]:text-slate-900 dark:[&_pre]:border-slate-700 dark:[&_pre]:bg-slate-900 dark:[&_pre]:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 dark:[&_th]:border-border dark:[&_th]:bg-muted/40 dark:[&_td]:border-border">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html selectedReportHtml}
          </article>
          {#if selectedReport.storageBucket !== null && selectedReport.storageKey !== null}
            <p class="mt-4 text-xs text-gray-500 dark:text-muted-foreground">
              Stored in S3: {selectedReport.storageBucket}/{selectedReport.storageKey}
            </p>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
