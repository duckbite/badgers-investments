<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerChartJs } from '$lib/charts/register-chart-js';
  import { buildChartJsTooltipTheme, readChartThemePalette } from '$lib/charts/chart-theme';

  export let title: string = '';
  export let description: string = '';
  export let labels: readonly string[] = [];
  export let values: readonly number[] = [];
  export let currencyCode: string = 'USD';
  export let emptyMessage: string = 'No data to chart yet.';

  let canvas: HTMLCanvasElement | undefined;
  let chart: Chart<'pie', number[], string> | undefined;
  let isChartClientReady: boolean = false;

  function destroyChart(): void {
    chart?.destroy();
    chart = undefined;
  }

  function rebuild(): void {
    destroyChart();
    if (canvas === undefined || labels.length === 0 || values.length === 0) {
      return;
    }
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    const palette = readChartThemePalette();
    const colors: readonly string[] = palette.chartColors;
    chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [...labels],
        datasets: [
          {
            data: [...values],
            backgroundColor: labels.map((_, i) => colors[i % colors.length] ?? '#6b7280'),
            borderWidth: 1,
            borderColor: palette.card,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: palette.mutedForeground, boxWidth: 12 },
          },
          tooltip: {
            ...buildChartJsTooltipTheme(palette),
            callbacks: {
              label(context) {
                const raw: unknown = context.raw;
                const value: number = typeof raw === 'number' ? raw : Number(raw);
                const datasetRaw: unknown = context.chart.data.datasets[0]?.data;
                const parts: number[] = Array.isArray(datasetRaw)
                  ? datasetRaw.map((x) => (typeof x === 'number' ? x : Number(x))).filter((x) => Number.isFinite(x))
                  : [];
                const sum: number = parts.reduce((a, b) => a + b, 0);
                const pct: number = sum > 0 && Number.isFinite(value) ? (value / sum) * 100 : 0;
                const formatted: string = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: currencyCode,
                }).format(value);
                const label: string = context.label.length > 0 ? `${context.label}: ` : '';
                return `${label}${pct.toFixed(0)}% · ${formatted}`;
              },
            },
          },
        },
      },
    });
  }

  onMount(() => {
    registerChartJs();
    isChartClientReady = true;
    return () => {
      destroyChart();
    };
  });

  $: if (isChartClientReady) {
    void [labels, values, currencyCode, canvas];
    rebuild();
  }
</script>

<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
  {#if title.length > 0}
    <h3 class="text-base font-semibold text-gray-900 dark:text-foreground">{title}</h3>
  {/if}
  {#if description.length > 0}
    <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">{description}</p>
  {/if}
  {#if labels.length === 0}
    <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">{emptyMessage}</p>
  {:else}
    <div class="relative mt-3 h-72">
      <canvas bind:this={canvas} class="max-h-72"></canvas>
    </div>
  {/if}
</div>
