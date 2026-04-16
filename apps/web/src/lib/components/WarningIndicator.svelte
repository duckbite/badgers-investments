<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  import { onMount } from 'svelte';

  export let message: string;
  export let ariaLabel: string = 'Warning details';

  let side: 'left' | 'right' = 'right';
  let triggerEl: HTMLSpanElement | null = null;

  function updateSide(): void {
    if (triggerEl === null || typeof window === 'undefined') {
      side = 'right';
      return;
    }
    const rect: DOMRect = triggerEl.getBoundingClientRect();
    side = rect.left > window.innerWidth / 2 ? 'left' : 'right';
  }

  onMount(() => {
    updateSide();
  });
</script>

<span class="group relative inline-flex items-center">
  <span
    bind:this={triggerEl}
    tabindex="0"
    role="button"
    aria-label={ariaLabel}
    class="inline-flex h-5 w-5 items-center justify-center rounded text-amber-600 outline-none transition-colors hover:text-amber-700 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:text-amber-400 dark:hover:text-amber-300"
    on:mouseenter={updateSide}
    on:focus={updateSide}
  >
    <AlertTriangle class="h-4 w-4" />
  </span>
  <span
    role="tooltip"
    class="pointer-events-none absolute top-1/2 z-30 w-max max-w-64 -translate-y-1/2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs leading-relaxed text-amber-900 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-amber-900/70 dark:bg-amber-950/90 dark:text-amber-200 {side === 'right' ? 'left-full ml-2' : 'right-full mr-2'}"
  >
    <span
      aria-hidden="true"
      class="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/90 {side === 'right' ? '-left-1.5 border-b border-l' : '-right-1.5 border-r border-t'}"
    ></span>
    {message}
  </span>
</span>
