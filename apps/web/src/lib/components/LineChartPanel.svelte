<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerChartJs } from '$lib/charts/register-chart-js';
  import {
    buildCartesianGridStyle,
    buildChartJsTooltipTheme,
    buildTickStyle,
    colorWithAlpha,
    readChartThemePalette,
    type ChartThemePalette,
  } from '$lib/charts/chart-theme';

  export let title: string = '';
  export let description: string = '';
  export let labels: readonly string[] = [];
  export let values: readonly number[] = [];
  export let datasetLabel: string = '';
  export let currencyCode: string = 'USD';
  export let emptyMessage: string = 'No series yet.';
  /** When false, line uses primary token with area fill (portfolio growth). */
  export let usePrimaryStroke: boolean = true;

  let canvas: HTMLCanvasElement | undefined;
  let chart: Chart<'line', number[], string> | undefined;
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
    const palette: ChartThemePalette = readChartThemePalette();
    const stroke: string = usePrimaryStroke ? palette.primary : palette.chartColors[1] ?? palette.primary;
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [...labels],
        datasets: [
          {
            label: datasetLabel,
            data: [...values],
            borderColor: stroke,
            backgroundColor: colorWithAlpha(stroke, 0.12),
            fill: true,
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: buildCartesianGridStyle(palette),
            ticks: { ...buildTickStyle(palette), autoSkip: true, maxTicksLimit: 8 },
          },
          y: {
            grid: buildCartesianGridStyle(palette),
            ticks: {
              color: palette.mutedForeground,
              callback(value) {
                const n: number = typeof value === 'number' ? value : Number(value);
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: currencyCode,
                  maximumFractionDigits: 0,
                }).format(n);
              },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...buildChartJsTooltipTheme(palette),
            callbacks: {
              label(context) {
                const raw: unknown = context.raw;
                const value: number = typeof raw === 'number' ? raw : Number(raw);
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value);
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
    void [labels, values, datasetLabel, currencyCode, usePrimaryStroke, canvas];
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
