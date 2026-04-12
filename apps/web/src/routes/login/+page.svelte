<script lang="ts">
  import { goto } from '$app/navigation';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';
  import { Lock, User } from 'lucide-svelte';

  let username: string = '';
  let password: string = '';
  let isSubmitting: boolean = false;

  async function executeLogin(): Promise<void> {
    if (isSubmitting) {
      return;
    }
    isSubmitting = true;
    try {
      await apiClient.executeJson<
        { readonly user: { readonly userId: string; readonly username: string } },
        { readonly username: string; readonly password: string }
      >({
        method: 'POST',
        path: '/auth/login',
        body: { username: username.trim(), password },
      });
      toast.success('Welcome back!', {
        description: 'Successfully logged in to Badgers Finance',
      });
      await goto('/dashboard');
    } catch {
      toast.error('Login failed', {
        description: 'Unable to sign in. Check your credentials and try again.',
      });
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Login · Badgers Finance</title>
</svelte:head>

<!-- Matches docs/prototype/src/app/pages/Login.tsx layout (Tailwind + shadcn tokens) -->
<div
  class="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-6 dark:from-emerald-950/30 dark:via-background dark:to-emerald-950/30"
>
  <div class="w-full max-w-md">
    <div class="mb-8 text-center">
      <img src="/badgers-logo.png" alt="Badgers Finance" class="mx-auto mb-4 h-20 w-auto" />
      <h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-foreground">Badgers Finance</h1>
      <p class="text-gray-600 dark:text-muted-foreground">Investment Monitoring &amp; Recommendations</p>
    </div>

    <div
      class="rounded-xl border-2 border-emerald-100 bg-card text-card-foreground shadow-xl dark:border-emerald-900/40"
    >
      <div class="space-y-1 px-6 pb-6 pt-6">
        <h2 class="text-center text-2xl font-semibold">Sign in to your account</h2>
        <p class="text-center text-sm text-muted-foreground">
          Enter your credentials to access your portfolio
        </p>
      </div>
      <div class="px-6 pb-6">
        <form class="space-y-4" on:submit|preventDefault={executeLogin}>
          <div class="space-y-2">
            <label class="text-sm font-medium leading-none" for="login-username">Username</label>
            <div class="relative">
              <User class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="login-username"
                class="flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 pl-10 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-input"
                type="text"
                autocomplete="username"
                placeholder="your-username"
                bind:value={username}
                required
              />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium leading-none" for="login-password">Password</label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="login-password"
                class="flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 pl-10 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-input"
                type="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                bind:value={password}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            class="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div class="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p class="mb-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">Local credentials</p>
          <div class="space-y-1 text-sm text-emerald-800 dark:text-emerald-200/90">
            <p><span class="font-medium">Username:</span> your <code class="rounded bg-white/70 px-1 dark:bg-black/20">BOOTSTRAP_USERNAME</code></p>
            <p><span class="font-medium">Password:</span> your <code class="rounded bg-white/70 px-1 dark:bg-black/20">BOOTSTRAP_PASSWORD</code></p>
            <p class="mt-2 border-t border-emerald-200 pt-2 text-xs text-emerald-800 dark:border-emerald-800 dark:text-emerald-300/90">
              Run <code class="rounded bg-white/70 px-1 dark:bg-black/20">pnpm bootstrap:user</code> from the repo root (see README).
            </p>
          </div>
        </div>
      </div>
    </div>

    <p class="mt-6 text-center text-sm text-gray-600 dark:text-muted-foreground">
      &copy; 2026 Badgers Finance. All rights reserved.
    </p>
  </div>
</div>
