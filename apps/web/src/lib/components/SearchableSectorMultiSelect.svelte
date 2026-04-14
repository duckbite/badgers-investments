<script lang="ts">
  import { Check, X } from 'lucide-svelte';

  export let options: readonly string[] = [];
  export let selected: string[] = [];

  let search: string = '';
  let listOpen: boolean = false;
  let rootEl: HTMLDivElement | undefined;

  $: needle = search.trim().toLowerCase();
  $: filtered = needle.length === 0 ? [...options] : options.filter((o) => o.toLowerCase().includes(needle));

  function isSelected(value: string): boolean {
    return selected.includes(value);
  }

  function toggle(value: string): void {
    if (isSelected(value)) {
      selected = selected.filter((s) => s !== value);
    } else {
      selected = [...selected, value];
    }
  }

  function removeChip(value: string): void {
    selected = selected.filter((s) => s !== value);
  }

  function handleWindowClick(event: MouseEvent): void {
    const t: EventTarget | null = event.target;
    if (rootEl === undefined || !(t instanceof Node) || rootEl.contains(t)) {
      return;
    }
    listOpen = false;
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="space-y-2" bind:this={rootEl}>
  <div class="relative">
    <input
      type="search"
      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-background"
      placeholder="Search sectors…"
      bind:value={search}
      on:focus={() => (listOpen = true)}
      autocomplete="off"
    />
    {#if listOpen && filtered.length > 0}
      <ul
        class="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-border dark:bg-popover"
        role="listbox"
      >
        {#each filtered as opt (opt)}
          <li role="option" aria-selected={isSelected(opt)}>
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-accent {isSelected(opt)
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30'
                : ''}"
              on:click={() => toggle(opt)}
            >
              <span
                class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-400 dark:border-border"
                aria-hidden="true"
              >
                {#if isSelected(opt)}
                  <Check class="h-3 w-3 text-emerald-600" />
                {/if}
              </span>
              <span class="min-w-0">{opt}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if selected.length > 0}
    <div class="flex flex-wrap gap-1.5">
      {#each selected as s (s)}
        <span
          class="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          <span class="truncate">{s}</span>
          <button
            type="button"
            class="rounded-full p-0.5 hover:bg-emerald-200/60 dark:hover:bg-emerald-800/60"
            aria-label={`Remove ${s}`}
            on:click={() => removeChip(s)}
          >
            <X class="h-3 w-3" />
          </button>
        </span>
      {/each}
    </div>
  {/if}

  <button
    type="button"
    class="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    on:click={() => (listOpen = !listOpen)}
  >
    {listOpen ? 'Hide list' : 'Show list'}
  </button>
</div>
