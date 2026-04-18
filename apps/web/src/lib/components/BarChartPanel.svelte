<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerChartJs } from '$lib/charts/register-chart-js';
  import {
    buildCartesianGridStyle,
    buildChartJsTooltipTheme,
    buildTickStyle,
    readChartThemePalette,
    type ChartThemePalette,
  } from '$lib/charts/chart-theme';

  export let title: string = '';
  export let description: string = '';
  export let labels: readonly string[] = [];
  export let datasets: readonly {
    readonly label: string;
    readonly data: readonly number[];
    readonly backgroundColor: string;
  }[] = [];
  export let emptyMessage: string = 'No data yet.';
  export let yTickPercent: boolean = false;
  export let yTickCurrency: string | undefined = undefined;
  export let stacked: boolean = false;
  export let chartHeightClass: string = 'h-72';

  let canvas: HTMLCanvasElement | undefined;
  let chart: Chart<'bar', number[], string> | undefined;
  let isChartClientReady: boolean = false;

  function destroyChart(): void {
    chart?.destroy();
    chart = undefined;
  }

  function rebuild(): void {
    destroyChart();
    if (canvas === undefined || labels.length === 0 || datasets.length === 0) {
      return;
    }
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    const palette: ChartThemePalette = readChartThemePalette();
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [...labels],
        datasets: datasets.map((d) => ({
          label: d.label,
          data: [...d.data],
          backgroundColor: d.backgroundColor,
          borderRadius: 4,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked,
            grid: buildCartesianGridStyle(palette),
            ticks: { ...buildTickStyle(palette), autoSkip: true, maxTicksLimit: 12 },
          },
          y: {
            stacked,
            grid: buildCartesianGridStyle(palette),
            ticks: {
              color: palette.mutedForeground,
              callback(value) {
                const n: number = typeof value === 'number' ? value : Number(value);
                if (yTickPercent) {
                  return `${n.toFixed(2)}%`;
                }
                if (yTickCurrency !== undefined) {
                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: yTickCurrency,
                    maximumFractionDigits: 0,
                  }).format(n);
                }
                return String(n);
              },
            },
          },
        },
        plugins: {
          legend: { display: true, labels: { color: palette.mutedForeground } },
          tooltip: {
            ...buildChartJsTooltipTheme(palette),
            callbacks: {
              label(context) {
                const raw: unknown = context.raw;
                const value: number = typeof raw === 'number' ? raw : Number(raw);
                if (yTickPercent) {
                  return `${context.dataset.label}: ${value.toFixed(2)}%`;
                }
                if (yTickCurrency !== undefined) {
                  return `${context.dataset.label}: ${new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: yTickCurrency,
                    maximumFractionDigits: 0,
                  }).format(value)}`;
                }
                return `${context.dataset.label}: ${String(value)}`;
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
    void [labels, datasets, yTickPercent, yTickCurrency, stacked, canvas];
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
  {#if labels.length === 0 || datasets.length === 0}
    <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">{emptyMessage}</p>
  {:else}
    <div class="relative mt-3 w-full {chartHeightClass}">
      <canvas bind:this={canvas} class="max-h-full"></canvas>
    </div>
  {/if}
</div>
