<svelte:head>
  <title>Assets · Badgers Investments</title>
</svelte:head>

<section class="stack">
  <header class="stack">
    <h1>Assets</h1>
    <p class="muted">Stocks and ETFs only for the MVP.</p>
  </header>
  <div class="placeholder">
    <div class="placeholderTitle">Coming soon</div>
    <div class="placeholderBody">This page will list holdings and allow creating/editing/archiving assets.</div>
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

