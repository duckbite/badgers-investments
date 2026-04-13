<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerChartJs } from '$lib/charts/register-chart-js';

  export let pieLabels: readonly string[] = [];
  export let pieValues: readonly number[] = [];
  export let lineLabels: readonly string[] = [];
  export let lineValues: readonly number[] = [];
  export let currencyCode: string = 'USD';

  let pieCanvas: HTMLCanvasElement | undefined;
  let lineCanvas: HTMLCanvasElement | undefined;
  let pieChart: Chart<'pie', number[], string> | undefined;
  let lineChart: Chart<'line', number[], string> | undefined;

  const pieColors: readonly string[] = [
    '#059669',
    '#0d9488',
    '#0891b2',
    '#2563eb',
    '#7c3aed',
    '#c026d3',
    '#db2777',
    '#ea580c',
  ];

  function destroyCharts(): void {
    pieChart?.destroy();
    pieChart = undefined;
    lineChart?.destroy();
    lineChart = undefined;
  }

  function buildPie(): void {
    if (pieCanvas === undefined || pieLabels.length === 0 || pieValues.length === 0) {
      return;
    }
    const ctx: CanvasRenderingContext2D | null = pieCanvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    pieChart?.destroy();
    pieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [...pieLabels],
        datasets: [
          {
            data: [...pieValues],
            backgroundColor: pieLabels.map((_, i) => pieColors[i % pieColors.length] ?? '#6b7280'),
            borderWidth: 1,
            borderColor: '#ffffff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label(context) {
                const raw: unknown = context.raw;
                const value: number = typeof raw === 'number' ? raw : Number(raw);
                const formatted: string = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: currencyCode,
                }).format(value);
                const label: string = context.label.length > 0 ? `${context.label}: ` : '';
                return `${label}${formatted}`;
              },
            },
          },
        },
      },
    });
  }

  function buildLine(): void {
    if (lineCanvas === undefined || lineLabels.length === 0 || lineValues.length === 0) {
      return;
    }
    const ctx: CanvasRenderingContext2D | null = lineCanvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    lineChart?.destroy();
    lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [...lineLabels],
        datasets: [
          {
            label: `Portfolio value (${currencyCode})`,
            data: [...lineValues],
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.15)',
            fill: true,
            tension: 0.2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: {
            ticks: {
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

  function rebuild(): void {
    destroyCharts();
    buildPie();
    buildLine();
  }

  let isChartClientReady: boolean = false;

  onMount(() => {
    registerChartJs();
    isChartClientReady = true;
    return () => {
      destroyCharts();
    };
  });

  $: if (isChartClientReady) {
    void [pieLabels, pieValues, lineLabels, lineValues, currencyCode, pieCanvas, lineCanvas];
    rebuild();
  }
</script>

<div class="grid gap-4 lg:grid-cols-2">
  <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-foreground">Allocation by holding</h3>
    {#if pieLabels.length === 0}
      <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">No positions to chart yet.</p>
    {:else}
      <div class="relative mt-2 h-64">
        <canvas bind:this={pieCanvas} class="max-h-64"></canvas>
      </div>
    {/if}
  </div>
  <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-foreground">Portfolio value (from TWR series)</h3>
    {#if lineLabels.length === 0}
      <p class="mt-3 text-sm text-gray-600 dark:text-muted-foreground">No performance rows yet — add data and rebuild snapshots.</p>
    {:else}
      <div class="relative mt-2 h-64">
        <canvas bind:this={lineCanvas} class="max-h-64"></canvas>
      </div>
    {/if}
  </div>
</div>
