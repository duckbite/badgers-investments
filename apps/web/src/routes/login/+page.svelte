<script lang="ts">
  import { goto } from '$app/navigation';
  import { apiClient } from '$lib/api/api-client-instance';
  import { toast } from '$lib/toast/toast';

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

<div class="page">
  <div class="inner">
    <div class="brandBlock">
      <img src="/badgers-logo.png" alt="Badgers Finance" class="logo" />
      <h1 class="brandTitle">Badgers Finance</h1>
      <p class="brandSubtitle">Investment Monitoring &amp; Recommendations</p>
    </div>

    <div class="card">
      <div class="cardHeader">
        <h2 class="cardTitle">Sign in to your account</h2>
        <p class="cardDescription">Enter your credentials to access your portfolio</p>
      </div>
      <div class="cardContent">
        <form class="form" on:submit|preventDefault={executeLogin}>
          <div class="fieldGroup">
            <label class="label" for="login-username">Username</label>
            <div class="inputWrap">
              <span class="inputIcon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="login-username"
                class="input"
                type="text"
                autocomplete="username"
                placeholder="your-username"
                bind:value={username}
                required
              />
            </div>
          </div>

          <div class="fieldGroup">
            <label class="label" for="login-password">Password</label>
            <div class="inputWrap">
              <span class="inputIcon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                class="input"
                type="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                bind:value={password}
                required
              />
            </div>
          </div>

          <button class="submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div class="demoCallout">
          <p class="demoTitle">Local credentials</p>
          <div class="demoLines">
            <p>
              <span class="demoKey">Username:</span>
              <span class="demoVal">your <code>BOOTSTRAP_USERNAME</code></span>
            </p>
            <p>
              <span class="demoKey">Password:</span>
              <span class="demoVal">your <code>BOOTSTRAP_PASSWORD</code></span>
            </p>
            <p class="demoHint">Run <code>pnpm bootstrap:user</code> from the repo root (see README).</p>
          </div>
        </div>
      </div>
    </div>

    <p class="footerNote">&copy; 2026 Badgers Finance. All rights reserved.</p>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    box-sizing: border-box;
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
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 45%, #ffffff 55%, #ecfdf5 100%);
  }
  .inner {
    width: 100%;
    max-width: 28rem;
  }
  .brandBlock {
    text-align: center;
    margin-bottom: 2rem;
  }
  .logo {
    display: block;
    height: 5rem;
    width: auto;
    margin: 0 auto 1rem;
    object-fit: contain;
  }
  .brandTitle {
    margin: 0 0 0.5rem;
    font-size: 1.875rem;
    font-weight: 700;
    line-height: 1.2;
    color: #111827;
    letter-spacing: -0.02em;
  }
  .brandSubtitle {
    margin: 0;
    font-size: 1rem;
    color: #4b5563;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: #ffffff;
    color: #111827;
    border-radius: 0.75rem;
    border: 2px solid #d1fae5;
    box-shadow:
      0 20px 25px -5px rgb(0 0 0 / 0.08),
      0 8px 10px -6px rgb(0 0 0 / 0.08);
  }
  .cardHeader {
    padding: 1.5rem 1.5rem 1.25rem;
    display: grid;
    gap: 0.375rem;
  }
  .cardTitle {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    color: #111827;
  }
  .cardDescription {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    text-align: center;
    color: #717182;
  }
  .cardContent {
    padding: 0 1.5rem 1.5rem;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .fieldGroup {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .label {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1;
    color: #111827;
  }
  .inputWrap {
    position: relative;
  }
  .inputIcon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    color: #9ca3af;
    pointer-events: none;
  }
  .input {
    box-sizing: border-box;
    width: 100%;
    min-height: 2.25rem;
    padding: 0.25rem 0.75rem 0.25rem 2.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 0.375rem;
    background: #f3f3f5;
    color: #111827;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .input::placeholder {
    color: #9ca3af;
  }
  .input:focus {
    border-color: #059669;
    box-shadow: 0 0 0 3px rgb(5 150 105 / 0.2);
  }
  .submit {
    width: 100%;
    margin-top: 0.125rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25rem;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    background: #059669;
    color: #ffffff;
    transition: background 0.15s ease;
  }
  .submit:hover:not(:disabled) {
    background: #047857;
  }
  .submit:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
  .demoCallout {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: 0.5rem;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
  }
  .demoTitle {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #064e3b;
  }
  .demoLines {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #065f46;
  }
  .demoLines p {
    margin: 0 0 0.25rem;
  }
  .demoLines p:last-child {
    margin-bottom: 0;
  }
  .demoKey {
    font-weight: 600;
  }
  .demoVal {
    font-weight: 400;
  }
  .demoHint {
    margin-top: 0.5rem !important;
    padding-top: 0.5rem;
    border-top: 1px solid #a7f3d0;
    font-size: 0.8125rem;
    color: #047857;
  }
  .demoLines code {
    font-size: 0.8125rem;
    padding: 0.1em 0.35em;
    border-radius: 0.25rem;
    background: rgb(255 255 255 / 0.7);
  }
  .footerNote {
    margin: 1.5rem 0 0;
    text-align: center;
    font-size: 0.875rem;
    color: #4b5563;
  }
</style>
