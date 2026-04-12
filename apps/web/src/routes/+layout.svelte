<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiClient } from '$lib/api/api-client-instance';
  import ToastHost from '$lib/toast/ToastHost.svelte';

  const navigationItems: ReadonlyArray<{ readonly href: string; readonly label: string }> = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/assets', label: 'Assets' },
    { href: '/ledger', label: 'Ledger' },
    { href: '/performance', label: 'Performance' },
    { href: '/recommendations', label: 'Recommendations' },
  ];

  function isNavigationItemActive(pathname: string, href: string): boolean {
    if (pathname === href) {
      return true;
    }
    return href !== '/' && pathname.startsWith(`${href}/`);
  }

  let isLoggingOut: boolean = false;

  async function executeLogout(): Promise<void> {
    if (isLoggingOut) {
      return;
    }
    isLoggingOut = true;
    try {
      await apiClient.executeJson<void>({ method: 'POST', path: '/auth/logout' });
    } catch {
    } finally {
      isLoggingOut = false;
      await goto('/login');
    }
  }
</script>

<ToastHost />

{#if $page.url.pathname === '/login'}
  <div class="loginShell">
    <slot />
  </div>
{:else}
  <div class="app">
    <header class="header">
      <a class="brand" href="/dashboard">Badgers Investments</a>
      <nav class="nav" aria-label="Primary">
        {#each navigationItems as navigationItem (navigationItem.href)}
          <a
            class:active={isNavigationItemActive($page.url.pathname, navigationItem.href)}
            href={navigationItem.href}
          >
            {navigationItem.label}
          </a>
        {/each}
      </nav>
      <div class="headerActions">
        <button
          class="logoutButton"
          type="button"
          disabled={isLoggingOut}
          on:click={executeLogout}
        >
          {isLoggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
    <main class="main">
      <slot />
    </main>
  </div>
{/if}

<style>
  .loginShell {
    min-height: 100vh;
  }
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: white;
  }
  .headerActions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .logoutButton {
    border: 1px solid rgba(0, 0, 0, 0.14);
    background: white;
    color: rgba(0, 0, 0, 0.78);
    padding: 0.4rem 0.65rem;
    border-radius: 0.375rem;
    font: inherit;
    cursor: pointer;
  }
  .logoutButton:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.04);
  }
  .logoutButton:disabled {
    opacity: 0.65;
    cursor: default;
  }
  .brand {
    font-weight: 700;
    letter-spacing: 0.2px;
    white-space: nowrap;
    text-decoration: none;
    color: inherit;
  }
  .nav {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .nav a {
    text-decoration: none;
    color: rgba(0, 0, 0, 0.72);
    padding: 0.35rem 0.5rem;
    border-radius: 0.375rem;
  }
  .nav a:hover {
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.9);
  }
  .nav a.active {
    background: rgba(0, 0, 0, 0.08);
    color: rgba(0, 0, 0, 0.9);
  }
  .main {
    flex: 1;
    max-width: 72rem;
    width: 100%;
    margin: 0 auto;
    padding: 1.25rem 1rem;
  }
</style>
