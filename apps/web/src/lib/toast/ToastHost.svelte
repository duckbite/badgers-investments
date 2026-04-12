<script lang="ts">
  import { dismissToast, toasts } from './toast';
</script>

<div class="viewport" aria-live="polite">
  {#each $toasts as item (item.id)}
    <div
      class="toast"
      class:toastError={item.variant === 'error'}
      class:toastSuccess={item.variant === 'success'}
      role="status"
    >
      <div class="toastInner">
        {#if item.variant === 'error'}
          <span class="icon iconError" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          </span>
        {:else}
          <span class="icon iconSuccess" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
        {/if}
        <div class="text">
          <p class="title">{item.title}</p>
          {#if item.description !== undefined && item.description.length > 0}
            <p class="description">{item.description}</p>
          {/if}
        </div>
        <button type="button" class="close" aria-label="Dismiss notification" on:click={() => dismissToast(item.id)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .viewport {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 24rem;
    width: min(24rem, calc(100vw - 2rem));
    pointer-events: none;
    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif;
  }
  .toast {
    pointer-events: auto;
    border-radius: 0.5rem;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: #ffffff;
    box-shadow:
      0 10px 15px -3px rgb(0 0 0 / 0.08),
      0 4px 6px -4px rgb(0 0 0 / 0.08);
    animation: toastIn 0.2s ease-out;
  }
  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translateX(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .toastError {
    border-color: #fecaca;
    background: #ffffff;
  }
  .toastSuccess {
    border-color: #a7f3d0;
    background: #ffffff;
  }
  .toastInner {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.85rem 0.65rem 0.85rem 0.85rem;
  }
  .icon {
    flex-shrink: 0;
    margin-top: 0.05rem;
    display: flex;
  }
  .iconError {
    color: #dc2626;
  }
  .iconSuccess {
    color: #059669;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.35;
    color: #111827;
  }
  .description {
    margin: 0.2rem 0 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #6b7280;
  }
  .close {
    flex-shrink: 0;
    margin: -0.15rem -0.1rem 0 0;
    padding: 0.2rem;
    border: none;
    background: transparent;
    color: #9ca3af;
    border-radius: 0.25rem;
    cursor: pointer;
    line-height: 0;
  }
  .close:hover {
    color: #4b5563;
    background: rgba(0, 0, 0, 0.04);
  }
</style>
