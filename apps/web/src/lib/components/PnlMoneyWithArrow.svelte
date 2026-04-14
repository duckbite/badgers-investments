<script lang="ts">
  import { ArrowDown, ArrowUp } from 'lucide-svelte';
  import { formatMaskedMoney } from '$lib/privacy/format-amount';

  export let masked: boolean;
  export let decimalString: string;
  export let currencyCode: string;
  /** When set, append ` (12.34%)` after the amount; masked shows ` (••••)`. */
  export let percentNumberPart: string | null = null;

  $: n = Number.parseFloat(decimalString);
  $: finite = Number.isFinite(n);
  $: kind = masked || !finite ? 'unknown' : n > 0 ? 'profit' : n < 0 ? 'loss' : 'flat';
</script>

<span class="inline-flex items-center gap-1 text-gray-800 dark:text-foreground">
  {#if kind === 'profit'}
    <span class="text-emerald-600 dark:text-emerald-400" aria-hidden="true">
      <ArrowUp class="h-3 w-3 shrink-0" strokeWidth={2.5} />
    </span>
  {:else if kind === 'loss'}
    <span class="text-red-600 dark:text-red-400" aria-hidden="true">
      <ArrowDown class="h-3 w-3 shrink-0" strokeWidth={2.5} />
    </span>
  {/if}
  <span class="text-gray-700 dark:text-muted-foreground">
    {formatMaskedMoney({ masked, decimalString, currencyCode })}{#if percentNumberPart !== null}<span
        class="text-gray-600 dark:text-muted-foreground"
      >
        {' '}({masked ? '••••' : `${percentNumberPart}%`})</span>{/if}
  </span>
</span>
