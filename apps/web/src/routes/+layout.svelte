<script lang="ts">
  import '../styles/index.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiClient } from '$lib/api/api-client-instance';
  import ToastHost from '$lib/toast/ToastHost.svelte';
  import { readResolvedThemeFromDocument, toggleTheme, type Theme } from '$lib/theme/theme';
  import {
    BookMarked,
    BookOpen,
    CircleDollarSign,
    Compass,
    DollarSign,
    Eye,
    LayoutDashboard,
    Lightbulb,
    Moon,
    Sun,
    TrendingUp,
    User,
    Wallet,
  } from 'lucide-svelte';

  const navigationItems = [
    { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { href: '/assets', label: 'Assets', Icon: Wallet },
    { href: '/prices', label: 'Prices', Icon: CircleDollarSign },
    { href: '/ledger', label: 'Ledger', Icon: BookOpen },
    { href: '/performance', label: 'Performance', Icon: TrendingUp },
    { href: '/recommendations', label: 'Recommendations', Icon: Lightbulb },
    { href: '/explore', label: 'Explore', Icon: Compass },
    { href: '/library', label: 'Library', Icon: BookMarked },
  ] as const;

  function isNavigationItemActive(pathname: string, href: string): boolean {
    if (pathname === href) {
      return true;
    }
    return href !== '/' && pathname.startsWith(`${href}/`);
  }

  let isLoggingOut: boolean = false;

  function getInitialTheme(): Theme {
    if (typeof document === 'undefined') {
      return 'light';
    }
    return readResolvedThemeFromDocument();
  }

  let themeMode: Theme = getInitialTheme();

  function handleThemeToggle(): void {
    toggleTheme();
    themeMode = readResolvedThemeFromDocument();
  }

  async function executeLogout(): Promise<void> {
    if (isLoggingOut) {
      return;
    }
    isLoggingOut = true;
    try {
      await apiClient.executeJson<void>({ method: 'POST', path: '/auth/logout' });
    } catch {
      void 0;
    } finally {
      isLoggingOut = false;
      await goto('/login');
    }
  }
</script>

<ToastHost />

{#if $page.url.pathname === '/login'}
  <slot />
{:else}
  <div class="min-h-screen bg-gray-50 dark:bg-background">
    <header class="border-b border-gray-200 bg-white dark:border-border dark:bg-card">
      <div class="px-6 py-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <a class="flex shrink-0 items-center" href="/dashboard">
            <img class="h-16 w-auto" src="/badgers-logo.png" alt="Badgers Finance" />
          </a>

          <div class="flex flex-wrap items-center gap-3">
            <div
              class="flex h-9 w-32 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 opacity-90 dark:border-border dark:bg-card dark:text-foreground"
              title="Base currency (DB-113)"
              aria-disabled="true"
            >
              <DollarSign class="h-4 w-4 shrink-0 text-gray-500 dark:text-muted-foreground" />
              <span>USD</span>
            </div>

            <button
              type="button"
              disabled
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white opacity-80 dark:border-border dark:bg-card"
              title="Hide amounts (DB-146)"
              aria-label="Amount privacy (coming soon)"
            >
              <Eye class="h-4 w-4 text-gray-600 dark:text-muted-foreground" />
            </button>

            <button
              type="button"
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50 dark:border-border dark:bg-card dark:hover:bg-accent"
              on:click={handleThemeToggle}
              aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={themeMode === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {#if themeMode === 'dark'}
                <Sun class="h-4 w-4 text-gray-600 dark:text-muted-foreground" />
              {:else}
                <Moon class="h-4 w-4 text-gray-600" />
              {/if}
            </button>

            <details class="relative">
              <summary
                class="flex cursor-pointer list-none items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 marker:hidden [&::-webkit-details-marker]:hidden dark:border-border dark:bg-card dark:text-foreground"
              >
                <User class="h-4 w-4" />
                Account
              </summary>
              <div
                class="absolute right-0 z-50 mt-1 min-w-56 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-border dark:bg-popover"
              >
                <button
                  type="button"
                  disabled
                  class="w-full cursor-not-allowed rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground"
                >
                  Profile
                </button>
                <button
                  type="button"
                  disabled
                  class="w-full cursor-not-allowed rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground"
                >
                  Risk appetite
                </button>
                <button
                  type="button"
                  disabled
                  class="w-full cursor-not-allowed rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground"
                >
                  Preferences
                </button>
                <div class="my-1 h-px bg-border" role="separator"></div>
                <button
                  type="button"
                  class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  disabled={isLoggingOut}
                  on:click={executeLogout}
                >
                  {isLoggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>

    <nav
      class="border-b border-gray-200 bg-white dark:border-border dark:bg-card"
      aria-label="Primary"
    >
      <div class="px-6">
        <div class="flex flex-wrap gap-1">
          {#each navigationItems as item (item.href)}
            {@const active = isNavigationItemActive($page.url.pathname, item.href)}
            <a
              class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {active
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-muted-foreground dark:hover:border-border dark:hover:text-foreground'}"
              href={item.href}
            >
              <svelte:component this={item.Icon} class="h-4 w-4 shrink-0" />
              {item.label}
            </a>
          {/each}
        </div>
      </div>
    </nav>

    <main class="px-6 py-6">
      <slot />
    </main>
  </div>
{/if}
