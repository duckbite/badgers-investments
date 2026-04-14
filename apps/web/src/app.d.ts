/// <reference types="@sveltejs/kit" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_API_BASE_URL?: string;
    readonly PUBLIC_AMOUNT_REVEAL_PIN?: string;
    /** Browser Maps JS key (Places). Restrict by HTTP referrer in Google Cloud. */
    readonly PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  }

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
