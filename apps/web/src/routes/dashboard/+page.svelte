<svelte:head>
  <title>Dashboard · Badgers Investments</title>
</svelte:head>

<section class="space-y-3">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-foreground">Dashboard</h1>
    <p class="text-sm text-gray-600 dark:text-muted-foreground">
      Wealth overview, allocations, P/L, freshness, and quick actions.
    </p>
  </header>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/assets"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Assets</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">
        View holdings and manage stock/ETF assets.
      </p>
    </a>
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/ledger"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Ledger</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">
        Add and filter transactions that drive holdings.
      </p>
    </a>
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/performance"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Performance</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">
        Time-weighted returns (TWR) and portfolio value trends.
      </p>
    </a>
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/recommendations"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Recommendations</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">
        Run rules + AI recommendations and review history.
      </p>
    </a>
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/explore"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Explore</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Analysis tools and workflows.</p>
    </a>
    <a
      class="rounded-xl border border-gray-200 bg-white p-4 text-inherit shadow-sm transition hover:border-gray-300 hover:shadow dark:border-border dark:bg-card dark:hover:border-border"
      href="/library"
    >
      <div class="font-semibold text-gray-900 dark:text-foreground">Library</div>
      <p class="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Saved analysis reports.</p>
    </a>
  </div>
</section>
