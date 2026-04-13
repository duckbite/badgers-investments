<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerChartJs } from '$lib/charts/register-chart-js';

  export let labels: readonly string[] = [];
  export let values: readonly number[] = [];
  export let datasetLabel: string = '';
  export let yTickCurrency: string | undefined = undefined;

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
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [...labels],
        datasets: [
          {
            label: datasetLabel,
            data: [...values],
            borderColor: '#0891b2',
            backgroundColor: 'rgba(8, 145, 178, 0.12)',
            fill: true,
            tension: 0.2,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
          y: {
            ticks: yTickCurrency
              ? {
                  callback(value) {
                    const n: number = typeof value === 'number' ? value : Number(value);
                    return new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: yTickCurrency,
                      maximumFractionDigits: 4,
                    }).format(n);
                  },
                }
              : {},
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const raw: unknown = context.raw;
                const value: number = typeof raw === 'number' ? raw : Number(raw);
                if (yTickCurrency === undefined) {
                  return String(value);
                }
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: yTickCurrency }).format(value);
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
    void [labels, values, datasetLabel, yTickCurrency, canvas];
    rebuild();
  }
</script>

<div class="relative h-56 w-full">
  <canvas bind:this={canvas} class="max-h-56"></canvas>
</div>
