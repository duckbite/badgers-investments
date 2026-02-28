<svelte:head>
  <title>Dashboard · Badgers Investments</title>
</svelte:head>

<section class="stack">
  <header class="stack">
    <h1>Dashboard</h1>
    <p class="muted">Wealth overview, allocations, P/L, freshness, and quick actions.</p>
  </header>
  <div class="grid">
    <a class="card" href="/assets">
      <div class="cardTitle">Assets</div>
      <div class="cardBody">View holdings and manage stock/ETF assets.</div>
    </a>
    <a class="card" href="/ledger">
      <div class="cardTitle">Ledger</div>
      <div class="cardBody">Add and filter transactions that drive holdings.</div>
    </a>
    <a class="card" href="/performance">
      <div class="cardTitle">Performance</div>
      <div class="cardBody">Time-weighted returns (TWR) and portfolio value trends.</div>
    </a>
    <a class="card" href="/recommendations">
      <div class="cardTitle">Recommendations</div>
      <div class="cardBody">Run rules + AI recommendations and review history.</div>
    </a>
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
  .grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }
  .card {
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 0.75rem;
    padding: 0.9rem;
    text-decoration: none;
    color: inherit;
    background: white;
    display: grid;
    gap: 0.35rem;
  }
  .card:hover {
    border-color: rgba(0, 0, 0, 0.16);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  }
  .cardTitle {
    font-weight: 650;
  }
  .cardBody {
    color: rgba(0, 0, 0, 0.66);
    font-size: 0.95rem;
    line-height: 1.35;
  }
</style>

