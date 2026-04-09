<script lang="ts">
  import { goto } from '$app/navigation';
  import { env } from '$env/dynamic/public';
  import { onMount } from 'svelte';

  type CheckStatus = 'checking' | 'up' | 'down';

  let backendStatus: CheckStatus = 'checking';
  let databaseStatus: CheckStatus = 'checking';
  let email: string = '';
  let isSubmitting: boolean = false;

  function getApiOrigin(): string {
    const raw: string | undefined = env.PUBLIC_API_BASE_URL;
    const base: string = raw !== undefined && raw.length > 0 ? raw : 'http://localhost:3000';
    return base.replace(/\/+$/, '');
  }

  async function loadChecks(): Promise<void> {
    const base: string = getApiOrigin();
    backendStatus = await fetchStatus(`${base}/health`);
    databaseStatus = await fetchStatus(`${base}/ready`);
  }

  async function fetchStatus(url: string): Promise<CheckStatus> {
    try {
      const response: Response = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
      return response.ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  async function executeLogin(): Promise<void> {
    if (isSubmitting) {
      return;
    }
    isSubmitting = true;
    try {
      await goto('/dashboard');
    } finally {
      isSubmitting = false;
    }
  }

  onMount((): void => {
    void loadChecks();
  });
</script>

<svelte:head>
  <title>Login · Badgers Investments</title>
</svelte:head>

<div class="container">
  <section class="card">
    <header class="header">
      <h1>Badgers Investments</h1>
      <p class="muted">Sign in (placeholder) to access your dashboard.</p>
    </header>

    <div class="checks">
      <div class="checkRow">
        <span class="dot" data-status={backendStatus} aria-hidden="true"></span>
        <span class="checkLabel">Backend</span>
        <span class="checkMeta">GET /health</span>
      </div>
      <div class="checkRow">
        <span class="dot" data-status={databaseStatus} aria-hidden="true"></span>
        <span class="checkLabel">Database</span>
        <span class="checkMeta">GET /ready</span>
      </div>
    </div>

    <form class="form" on:submit|preventDefault={executeLogin}>
      <label class="field">
        <span class="fieldLabel">Email</span>
        <input
          class="input"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="you@example.com"
          bind:value={email}
          required
        />
      </label>
      <button class="button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>

    <p class="hint">
      This is a fake login for now. The button just navigates to the dashboard.
    </p>
  </section>
</div>

<style>
  .container {
    min-height: calc(100vh - 4rem);
    display: grid;
    place-items: center;
    padding: 2rem 1rem;
  }
  .card {
    width: 100%;
    max-width: 26rem;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 1rem;
    background: white;
    padding: 1.25rem;
    display: grid;
    gap: 1rem;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  }
  .header {
    display: grid;
    gap: 0.35rem;
  }
  .muted {
    color: rgba(0, 0, 0, 0.62);
    margin: 0;
  }
  h1 {
    margin: 0;
    font-size: 1.35rem;
    letter-spacing: 0.2px;
  }
  .checks {
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 0.75rem;
    padding: 0.75rem;
    display: grid;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.02);
  }
  .checkRow {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.5rem;
  }
  .checkLabel {
    font-weight: 650;
  }
  .checkMeta {
    color: rgba(0, 0, 0, 0.55);
    font-size: 0.9rem;
  }
  .dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 999px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    background: rgba(0, 0, 0, 0.12);
  }
  .dot[data-status='checking'] {
    background: rgba(0, 0, 0, 0.18);
  }
  .dot[data-status='up'] {
    background: #23c55e;
    border-color: rgba(0, 0, 0, 0.12);
  }
  .dot[data-status='down'] {
    background: #ef4444;
    border-color: rgba(0, 0, 0, 0.12);
  }
  .form {
    display: grid;
    gap: 0.75rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
  }
  .fieldLabel {
    font-weight: 650;
    font-size: 0.95rem;
  }
  .input {
    border: 1px solid rgba(0, 0, 0, 0.14);
    border-radius: 0.6rem;
    padding: 0.65rem 0.75rem;
    font-size: 1rem;
  }
  .input:focus {
    outline: none;
    border-color: rgba(0, 0, 0, 0.32);
    box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.06);
  }
  .button {
    border: none;
    border-radius: 0.65rem;
    padding: 0.7rem 0.85rem;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    cursor: pointer;
  }
  .button:disabled {
    cursor: default;
    opacity: 0.6;
  }
  .hint {
    margin: 0;
    color: rgba(0, 0, 0, 0.55);
    font-size: 0.9rem;
    line-height: 1.35;
  }
</style>

