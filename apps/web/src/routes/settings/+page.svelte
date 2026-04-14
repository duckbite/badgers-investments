<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { buildPortfolioConfigPutBody, type PortfolioConfigDto } from '$lib/api/build-portfolio-config-put-body';
  import { apiClient } from '$lib/api/api-client-instance';
  import GooglePlacesLocationInput from '$lib/components/GooglePlacesLocationInput.svelte';
  import SearchableSectorMultiSelect from '$lib/components/SearchableSectorMultiSelect.svelte';
  import WholeCurrencyAmountInput from '$lib/components/WholeCurrencyAmountInput.svelte';
  import { ALLOWED_CURRENCY_CODES } from '$lib/domain/allowed-currency-codes';
  import { INVESTMENT_SECTOR_OPTIONS } from '$lib/domain/investment-sector-options';
  import { toast } from '$lib/toast/toast';
  import { Check, Loader2, Lock, Sparkles, Target, User, X } from 'lucide-svelte';

  type TabId = 'profile' | 'investment' | 'ai' | 'security';

  type AiSettingsDto = {
    readonly provider: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE_GEMINI';
    readonly modelId: string;
    readonly apiKeyMasked: string | null;
    readonly hasStoredApiKey: boolean;
    readonly lastVerifyOk: boolean | null;
    readonly lastVerifiedAt: string | null;
    readonly updatedAt: string | null;
  };

  const tabs: readonly { id: TabId; label: string; description: string; Icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', description: 'Personal details', Icon: User },
    { id: 'investment', label: 'Investing', description: 'Risk & preferences', Icon: Target },
    { id: 'ai', label: 'AI', description: 'Provider & key', Icon: Sparkles },
    { id: 'security', label: 'Security', description: 'Password & PIN', Icon: Lock },
  ] as const;

  const riskOptions = ['CONSERVATIVE', 'MODERATE', 'BALANCED', 'GROWTH', 'AGGRESSIVE'] as const;

  const googleMapsApiKey: string = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const maxDobIso: string = new Date().toISOString().slice(0, 10);

  function normalizeCurrencyCode(code: string, fallback: string): string {
    const u = code.trim().toUpperCase();
    return ALLOWED_CURRENCY_CODES.includes(u) ? u : fallback;
  }

  function parseTab(raw: string | null): TabId {
    if (raw === 'profile' || raw === 'investment' || raw === 'ai' || raw === 'security') {
      return raw;
    }
    return 'profile';
  }

  $: activeTab = parseTab($page.url.searchParams.get('tab'));

  function goTab(id: TabId): void {
    void goto(`/settings?tab=${id}`, { replaceState: true, noScroll: true });
  }

  let loading: boolean = true;
  let saving: boolean = false;

  let cfg: PortfolioConfigDto | undefined;
  let displayName: string = '';
  let gender: string = '';
  let dateOfBirth: string = '';
  let locationLabel: string = '';
  let locationPlaceId: string = '';
  let locationLat: number | null = null;
  let locationLng: number | null = null;
  let monthlyCurrency: string = 'USD';
  let monthlyAmountWhole: number | null = null;
  let riskProfileType: string = 'MODERATE';
  let riskScoreStr: string = '';
  let goalsEarlyPension: boolean = false;
  let goalsHouse: boolean = false;
  let goalsSavings: boolean = false;
  let goalsFi: boolean = false;
  let selectedSectors: string[] = [];
  let esgPriority: string = 'MEDIUM';
  let marketsFocus: string = '';

  let aiProvider: AiSettingsDto['provider'] = 'OPENAI';
  let aiKeyInput: string = '';
  let aiSettings: AiSettingsDto | undefined;
  let aiVerifyLoading: boolean = false;

  let pwCurrent: string = '';
  let pwNew: string = '';
  let pinNew: string = '';
  let pinConfirm: string = '';
  let hasAmountRevealPin: boolean = false;
  /** Bumps when profile is (re)loaded from the server so the Places widget remounts with saved text. */
  let profileHydrationKey = 0;

  function parsePrefs(input: unknown): Record<string, unknown> {
    if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
      return input as Record<string, unknown>;
    }
    return {};
  }

  function readProfile(prefs: Record<string, unknown>, baseCurrency: string): void {
    const fallbackCurrency = normalizeCurrencyCode(baseCurrency, 'USD');
    const profile = prefs['profile'];
    if (profile !== null && typeof profile === 'object' && !Array.isArray(profile)) {
      const p = profile as Record<string, unknown>;
      displayName = typeof p['displayName'] === 'string' ? p['displayName'] : '';
      gender = typeof p['gender'] === 'string' ? p['gender'] : '';
      const dobRaw = p['dateOfBirth'];
      dateOfBirth =
        typeof dobRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? dobRaw : '';
      locationLabel = typeof p['locationLabel'] === 'string' ? p['locationLabel'] : '';
      locationPlaceId = typeof p['locationPlaceId'] === 'string' ? p['locationPlaceId'] : '';
      const lat = p['locationLat'];
      const lng = p['locationLng'];
      locationLat = typeof lat === 'number' && Number.isFinite(lat) ? lat : null;
      locationLng = typeof lng === 'number' && Number.isFinite(lng) ? lng : null;

      const mi = p['monthlyInvestableIncome'];
      if (mi !== null && typeof mi === 'object' && !Array.isArray(mi)) {
        const o = mi as Record<string, unknown>;
        monthlyCurrency = normalizeCurrencyCode(String(o['currencyCode'] ?? ''), fallbackCurrency);
        const aw = o['amountWhole'];
        monthlyAmountWhole =
          typeof aw === 'number' && Number.isFinite(aw) ? Math.max(0, Math.trunc(aw)) : null;
      } else if (typeof mi === 'string' && mi.trim().length > 0) {
        const digits = mi.replace(/\D/g, '');
        monthlyAmountWhole = digits.length > 0 ? Number.parseInt(digits, 10) : null;
        monthlyCurrency = fallbackCurrency;
      } else {
        monthlyAmountWhole = null;
        monthlyCurrency = fallbackCurrency;
      }
    } else {
      displayName = '';
      gender = '';
      dateOfBirth = '';
      locationLabel = '';
      locationPlaceId = '';
      locationLat = null;
      locationLng = null;
      monthlyAmountWhole = null;
      monthlyCurrency = fallbackCurrency;
    }
  }

  function readInvestmentPrefs(prefs: Record<string, unknown>): void {
    const g = prefs['investmentGoals'];
    if (Array.isArray(g)) {
      goalsEarlyPension = g.includes('EARLY_PENSION');
      goalsHouse = g.includes('HOUSE');
      goalsSavings = g.includes('SAVINGS');
      goalsFi = g.includes('FI');
    }
    const se = prefs['sectorExclusions'];
    if (Array.isArray(se)) {
      selectedSectors = se.filter((x): x is string => typeof x === 'string');
    } else if (typeof se === 'string' && se.trim().length > 0) {
      selectedSectors = se
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    } else {
      selectedSectors = [];
    }
    esgPriority = typeof prefs['esgPriority'] === 'string' ? prefs['esgPriority'] : 'MEDIUM';
    marketsFocus = typeof prefs['marketsFocus'] === 'string' ? prefs['marketsFocus'] : '';
  }

  function buildGoals(): string[] {
    const out: string[] = [];
    if (goalsEarlyPension) {
      out.push('EARLY_PENSION');
    }
    if (goalsHouse) {
      out.push('HOUSE');
    }
    if (goalsSavings) {
      out.push('SAVINGS');
    }
    if (goalsFi) {
      out.push('FI');
    }
    return out;
  }

  async function loadAll(): Promise<void> {
    loading = true;
    try {
      const [c, ai, priv] = await Promise.all([
        apiClient.executeJson<PortfolioConfigDto>({ method: 'GET', path: '/portfolio/config' }),
        apiClient.executeJson<AiSettingsDto>({ method: 'GET', path: '/settings/ai' }),
        apiClient.executeJson<{ readonly hasAmountRevealPin: boolean }>({ method: 'GET', path: '/settings/privacy' }),
      ]);
      cfg = c;
      riskProfileType = c.riskProfileType;
      riskScoreStr = c.riskScore === null ? '' : String(c.riskScore);
      const prefs = parsePrefs(c.preferences);
      readProfile(prefs, c.baseCurrencyCode);
      readInvestmentPrefs(prefs);
      profileHydrationKey += 1;
      aiSettings = ai;
      aiProvider = ai.provider;
      aiKeyInput = '';
      hasAmountRevealPin = priv.hasAmountRevealPin;
    } catch (e) {
      toast.error('Could not load settings', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadAll();
  });

  async function saveProfileAndInvestment(): Promise<void> {
    if (cfg === undefined) {
      return;
    }
    saving = true;
    try {
      const prefs = parsePrefs(cfg.preferences);
      const fallbackCurrency = normalizeCurrencyCode(cfg.baseCurrencyCode, 'USD');

      if (dateOfBirth.trim().length > 0) {
        const parsed = new Date(`${dateOfBirth.trim()}T12:00:00`);
        if (Number.isNaN(parsed.getTime()) || parsed > new Date()) {
          toast.error('Date of birth must be a valid date in the past.');
          return;
        }
      }

      const profile: Record<string, unknown> = {};
      if (displayName.trim().length > 0) {
        profile.displayName = displayName.trim();
      }
      if (gender.trim().length > 0) {
        profile.gender = gender.trim();
      }
      if (dateOfBirth.trim().length > 0) {
        profile.dateOfBirth = dateOfBirth.trim();
      }
      if (locationLabel.trim().length > 0) {
        profile.locationLabel = locationLabel.trim();
        if (locationPlaceId.trim().length > 0) {
          profile.locationPlaceId = locationPlaceId.trim();
        }
        if (locationLat !== null && locationLng !== null) {
          profile.locationLat = locationLat;
          profile.locationLng = locationLng;
        }
      }
      if (monthlyAmountWhole !== null && monthlyAmountWhole > 0) {
        profile.monthlyInvestableIncome = {
          currencyCode: normalizeCurrencyCode(monthlyCurrency, fallbackCurrency),
          amountWhole: monthlyAmountWhole,
        };
      }
      const nextPrefs: Record<string, unknown> = {
        ...prefs,
        profile,
        investmentGoals: buildGoals(),
        sectorExclusions: selectedSectors.length > 0 ? selectedSectors : undefined,
        esgPriority: esgPriority,
        marketsFocus: marketsFocus.trim() || undefined,
      };
      const riskScore: number | null = riskScoreStr.trim() === '' ? null : Number(riskScoreStr);
      if (riskScore !== null && (!Number.isInteger(riskScore) || riskScore < 1 || riskScore > 100)) {
        toast.error('Risk score must be blank or an integer 1–100.');
        return;
      }
      await apiClient.executeJson<PortfolioConfigDto, ReturnType<typeof buildPortfolioConfigPutBody>>({
        method: 'PUT',
        path: '/portfolio/config',
        body: buildPortfolioConfigPutBody(cfg, {
          riskProfileType,
          riskScore,
          preferences: nextPrefs,
        }),
      });
      toast.success('Saved');
      await loadAll();
    } catch (e) {
      toast.error('Save failed', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      saving = false;
    }
  }

  async function saveAi(): Promise<void> {
    saving = true;
    try {
      const body: { provider: string; apiKey?: string } = { provider: aiProvider };
      if (aiKeyInput.trim().length > 0) {
        body.apiKey = aiKeyInput.trim();
      }
      const next = await apiClient.executeJson<AiSettingsDto, typeof body>({
        method: 'PUT',
        path: '/settings/ai',
        body,
      });
      aiSettings = next;
      aiKeyInput = '';
      toast.success('AI settings saved');
    } catch (e) {
      toast.error('AI settings failed', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      saving = false;
    }
  }

  async function verifyAi(): Promise<void> {
    aiVerifyLoading = true;
    try {
      const r = await apiClient.executeJson<{ readonly ok: boolean }>({ method: 'POST', path: '/settings/ai/verify' });
      aiSettings = await apiClient.executeJson<AiSettingsDto>({ method: 'GET', path: '/settings/ai' });
      if (r.ok) {
        toast.success('Provider accepted the API key');
      } else {
        toast.error('Provider rejected the API key');
      }
    } catch (e) {
      toast.error('Verification failed', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      aiVerifyLoading = false;
    }
  }

  async function clearAiKey(): Promise<void> {
    saving = true;
    try {
      await apiClient.executeJson<AiSettingsDto, { readonly provider: string; readonly apiKey: string }>({
        method: 'PUT',
        path: '/settings/ai',
        body: { provider: aiProvider, apiKey: '' },
      });
      aiSettings = await apiClient.executeJson<AiSettingsDto>({ method: 'GET', path: '/settings/ai' });
      toast.success('Stored API key removed');
    } catch (e) {
      toast.error('Could not clear key', { description: e instanceof Error ? e.message : '' });
    } finally {
      saving = false;
    }
  }

  async function savePassword(): Promise<void> {
    saving = true;
    try {
      await apiClient.executeJson<void, { readonly currentPassword: string; readonly newPassword: string }>({
        method: 'POST',
        path: '/auth/change-password',
        body: { currentPassword: pwCurrent, newPassword: pwNew },
      });
      pwCurrent = '';
      pwNew = '';
      toast.success('Password updated');
    } catch (e) {
      toast.error('Password change failed', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      saving = false;
    }
  }

  async function saveAmountPin(): Promise<void> {
    if (pinNew !== pinConfirm) {
      toast.error('PINs do not match');
      return;
    }
    saving = true;
    try {
      await apiClient.executeJson<void, { readonly pin: string }>({
        method: 'PUT',
        path: '/settings/privacy/amount-reveal-pin',
        body: { pin: pinNew },
      });
      pinNew = '';
      pinConfirm = '';
      toast.success('Amount reveal PIN saved');
      await loadAll();
    } catch (e) {
      toast.error('Could not save PIN', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Settings — Badgers</title>
</svelte:head>

<div
  class="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-emerald-50/40 via-gray-50/80 to-gray-50 dark:from-emerald-950/20 dark:via-background dark:to-background"
>
  <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <div class="mb-10">
      <h1 class="text-3xl font-semibold tracking-tight text-gray-900 dark:text-foreground">Settings</h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-muted-foreground">
        Profile and preferences are stored with your portfolio configuration. Base currency stays in the header so it stays in sync everywhere you review wealth.
      </p>
    </div>

    <div class="flex flex-col gap-10 lg:flex-row lg:gap-12">
      <aside class="lg:w-64 lg:shrink-0">
        <nav class="flex flex-row gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Settings sections">
          {#each tabs as tab (tab.id)}
            {@const Icon = tab.Icon}
            <button
              type="button"
              class="flex min-w-[10.5rem] items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:min-w-0 {activeTab === tab.id
                ? 'border-emerald-300 bg-white shadow-md ring-1 ring-emerald-500/20 dark:border-emerald-800 dark:bg-card'
                : 'border-transparent bg-white/60 hover:border-gray-200 hover:bg-white dark:bg-card/50 dark:hover:border-border'}"
              on:click={() => goTab(tab.id)}
            >
              <span
                class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg {activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground'}"
              >
                <Icon class="h-4 w-4" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-gray-900 dark:text-foreground">{tab.label}</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">{tab.description}</span>
              </span>
            </button>
          {/each}
        </nav>
      </aside>

      <div class="min-w-0 flex-1">
        {#if loading}
          <div class="flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white/80 px-8 py-16 text-muted-foreground dark:border-border dark:bg-card/80">
            <Loader2 class="h-5 w-5 animate-spin" />
            Loading settings…
          </div>
        {:else if activeTab === 'profile'}
          <section
            class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-border dark:bg-card sm:p-8"
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">Profile</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              These fields are stored in your portfolio preferences and travel with versioned config.
            </p>
            <div class="mt-6 space-y-4">
              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Display name</span>
                <input class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background" bind:value={displayName} />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Gender (optional)</span>
                <input class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background" bind:value={gender} />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Date of birth (optional)</span>
                <input
                  type="date"
                  class="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                  min="1900-01-01"
                  max={maxDobIso}
                  bind:value={dateOfBirth}
                />
              </label>
              <div class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Location (optional)</span>
                {#key profileHydrationKey}
                  <GooglePlacesLocationInput
                    apiKey={googleMapsApiKey}
                    bind:value={locationLabel}
                    bind:placeId={locationPlaceId}
                    on:place={(e) => {
                      locationLat = e.detail.lat;
                      locationLng = e.detail.lng;
                    }}
                  />
                {/key}
                {#if googleMapsApiKey.trim().length === 0}
                  <p class="mt-1 text-xs text-muted-foreground">
                    Set <code class="rounded bg-muted px-1 py-0.5 text-[0.7rem]">PUBLIC_GOOGLE_MAPS_API_KEY</code> in root
                    <code class="rounded bg-muted px-1 py-0.5 text-[0.7rem]">.env</code> and restart Vite for address suggestions (enable Places API (New) on the GCP project and key).
                  </p>
                {/if}
              </div>
              <div class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >Monthly investable income (optional)</span
                >
                <WholeCurrencyAmountInput bind:currencyCode={monthlyCurrency} bind:amountWhole={monthlyAmountWhole} />
                <p class="mt-1 text-xs text-muted-foreground">Whole numbers only; thousands separators follow your locale.</p>
              </div>
            </div>
            <button
              type="button"
              class="mt-8 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              disabled={saving}
              on:click={saveProfileAndInvestment}
            >
              {#if saving}
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
              {/if}
              Save profile
            </button>
          </section>
        {:else if activeTab === 'investment'}
          <section
            class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-border dark:bg-card sm:p-8"
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">Investing preferences</h2>
            <p class="mt-1 text-sm text-muted-foreground">Used with your active portfolio configuration version (DB-112).</p>
            <div class="mt-6 space-y-6">
              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk profile</span>
                <select
                  class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                  bind:value={riskProfileType}
                >
                  {#each riskOptions as r (r)}
                    <option value={r}>{r}</option>
                  {/each}
                </select>
              </label>
              <div>
                <label class="block" for="risk-score-input">
                  <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk score (optional)</span>
                </label>
                <input
                  id="risk-score-input"
                  class="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                  bind:value={riskScoreStr}
                  inputmode="numeric"
                  placeholder="e.g. 65"
                />
                <p class="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  A 1–100 self-assessment of how much portfolio volatility you can tolerate. It complements the categorical risk profile: higher scores imply
                  comfort with larger drawdowns in pursuit of growth; lower scores imply prioritising stability. Leave blank if you only use the profile above.
                </p>
              </div>
              <fieldset class="space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-border dark:bg-muted/30">
                <legend class="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Investment goals</legend>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" bind:checked={goalsEarlyPension} class="rounded border-gray-300" />
                  Early pension
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" bind:checked={goalsHouse} class="rounded border-gray-300" />
                  Buying a home
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" bind:checked={goalsSavings} class="rounded border-gray-300" />
                  General savings
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" bind:checked={goalsFi} class="rounded border-gray-300" />
                  Financial independence
                </label>
              </fieldset>
              <div>
                <span class="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Sectors to avoid</span>
                <SearchableSectorMultiSelect options={INVESTMENT_SECTOR_OPTIONS} bind:selected={selectedSectors} />
              </div>
              <div>
                <label class="block" for="esg-select">
                  <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">ESG priority</span>
                </label>
                <select
                  id="esg-select"
                  class="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                  bind:value={esgPriority}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
                <p class="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  How strongly environmental, social, and governance factors should influence recommendations and screening. Low keeps ESG as a light
                  preference; high increases emphasis on sustainable and responsible criteria when the rules engine supports it.
                </p>
              </div>
              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Markets focus</span>
                <textarea
                  class="min-h-[5rem] w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                  bind:value={marketsFocus}
                ></textarea>
              </label>
            </div>
            <button
              type="button"
              class="mt-8 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              disabled={saving}
              on:click={saveProfileAndInvestment}
            >
              {#if saving}
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
              {/if}
              Save investing preferences
            </button>
          </section>
        {:else if activeTab === 'ai'}
          <section
            class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-border dark:bg-card sm:p-8"
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">AI provider</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              Choose a provider and paste your API key. Keys are encrypted at rest (<code class="rounded bg-muted px-1 text-xs">API_AI_SETTINGS_SECRET</code>).
              The model is fixed per provider via server configuration (<code class="rounded bg-muted px-1 text-xs">API_AI_MODEL_*</code> in <code
                class="rounded bg-muted px-1 text-xs">.env</code>).
            </p>
            <div class="mt-6 space-y-4">
              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Provider</span>
                <select
                  class="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                  bind:value={aiProvider}
                >
                  <option value="OPENAI">OpenAI</option>
                  <option value="ANTHROPIC">Claude (Anthropic)</option>
                  <option value="GOOGLE_GEMINI">Gemini (Google)</option>
                </select>
              </label>
              {#if aiSettings}
                <div class="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm dark:border-border dark:bg-muted/40">
                  <span class="font-medium text-foreground">Configured model</span>
                  <span class="mt-1 block font-mono text-xs text-muted-foreground">{aiSettings.modelId}</span>
                </div>
              {/if}
              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">API key</span>
                <input
                  class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                  bind:value={aiKeyInput}
                  type="password"
                  autocomplete="off"
                  placeholder={aiSettings?.hasStoredApiKey ? 'Leave blank to keep existing key' : 'Paste API key'}
                />
              </label>
              {#if aiSettings?.hasStoredApiKey}
                <p class="text-xs text-muted-foreground">Stored key: {aiSettings.apiKeyMasked ?? '••••'}</p>
              {/if}
              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-border dark:hover:bg-accent"
                  disabled={saving || !aiSettings?.hasStoredApiKey}
                  on:click={verifyAi}
                >
                  {#if aiVerifyLoading}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                  {/if}
                  Test connection
                </button>
                {#if aiSettings?.lastVerifyOk === true}
                  <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check class="h-4 w-4" /> OK
                  </span>
                {:else if aiSettings?.lastVerifyOk === false}
                  <span class="inline-flex items-center gap-1 text-destructive"><X class="h-4 w-4" /> Failed</span>
                {/if}
              </div>
            </div>
            <div class="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                disabled={saving}
                on:click={saveAi}
              >
                Save
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                disabled={saving || !aiSettings?.hasStoredApiKey}
                on:click={clearAiKey}
              >
                Clear stored key
              </button>
            </div>
          </section>
        {:else if activeTab === 'security'}
          <div class="space-y-8">
            <section
              class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-border dark:bg-card sm:p-8"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">Sign-in password</h2>
              <p class="mt-1 text-sm text-muted-foreground">Update the password you use to log into this app.</p>
              <div class="mt-6 max-w-md space-y-4">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Current password</span>
                  <input
                    class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                    bind:value={pwCurrent}
                    type="password"
                    autocomplete="current-password"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">New password (min 8 characters)</span>
                  <input
                    class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                    bind:value={pwNew}
                    type="password"
                    autocomplete="new-password"
                  />
                </label>
              </div>
              <button
                type="button"
                class="mt-6 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                disabled={saving || pwNew.length < 8}
                on:click={savePassword}
              >
                Update password
              </button>
            </section>
            <section
              class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-border dark:bg-card sm:p-8"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-foreground">Amount reveal PIN</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                After you turn on anonymize in the header, this PIN is required to show amounts again. It is stored on the server as a salted hash; configure
                <code class="rounded bg-muted px-1 text-xs">API_PRIVACY_SECRET</code> (or <code class="rounded bg-muted px-1 text-xs">API_AI_SETTINGS_SECRET</code>)
                on the API.
              </p>
              {#if hasAmountRevealPin}
                <p class="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">A PIN is already set. Enter a new one below to replace it.</p>
              {/if}
              <div class="mt-6 max-w-md space-y-4">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">New PIN (4–64 characters)</span>
                  <input
                    class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                    bind:value={pinNew}
                    type="password"
                    autocomplete="new-password"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Confirm PIN</span>
                  <input
                    class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
                    bind:value={pinConfirm}
                    type="password"
                    autocomplete="new-password"
                  />
                </label>
              </div>
              <button
                type="button"
                class="mt-6 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                disabled={saving || pinNew.length < 4}
                on:click={saveAmountPin}
              >
                Save PIN
              </button>
            </section>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
