import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY: string = 'badgers-mask-amounts';

function readMaskedFromSession(): boolean {
  if (!browser) {
    return false;
  }
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

function persistMasked(input: { readonly masked: boolean }): void {
  if (!browser) {
    return;
  }
  if (input.masked) {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function createAmountPrivacyStore() {
  const { subscribe, set } = writable<boolean>(false);

  return {
    subscribe,
    hydrateFromSession(): void {
      set(readMaskedFromSession());
    },
    mask(): void {
      set(true);
      persistMasked({ masked: true });
    },
    revealAfterPin(): void {
      set(false);
      persistMasked({ masked: false });
    },
    getExpectedPin(): string {
      const fromEnv: string | undefined = import.meta.env.PUBLIC_AMOUNT_REVEAL_PIN?.trim();
      if (fromEnv !== undefined && fromEnv.length > 0) {
        return fromEnv;
      }
      return '1234';
    },
  };
}

export const amountPrivacy = createAmountPrivacyStore();
