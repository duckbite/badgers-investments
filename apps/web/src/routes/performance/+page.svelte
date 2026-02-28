<svelte:head>
  <title>Performance · Badgers Investments</title>
</svelte:head>

<section class="stack">
  <header class="stack">
    <h1>Performance</h1>
    <p class="muted">TWR (daily) and portfolio value trends.</p>
  </header>
  <div class="placeholder">
    <div class="placeholderTitle">Coming soon</div>
    <div class="placeholderBody">This page will render charts and selectable ranges (1M, 3M, YTD, 1Y, All).</div>
  </div>
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
  }
  .muted {
    color: rgba(0, 0, 0, 0.62);
    margin: 0;
  }
  .placeholder {
    border: 1px dashed rgba(0, 0, 0, 0.18);
    border-radius: 0.75rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.02);
    display: grid;
    gap: 0.25rem;
  }
  .placeholderTitle {
    font-weight: 650;
  }
  .placeholderBody {
    color: rgba(0, 0, 0, 0.66);
  }
</style>

