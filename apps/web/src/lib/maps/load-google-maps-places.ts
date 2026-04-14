/**
 * Loads the Maps JavaScript API, then the Places library via `importLibrary('places')`.
 *
 * With `loading=async`, `script.onload` can fire **before** `google.maps.importLibrary` exists, which
 * breaks a naive loader. We use a JSONP `callback=` (Google-supported) plus a short poll fallback.
 *
 * Requires **Places API (New)** for `PlaceAutocompleteElement` (see `.env.example`).
 */
let bootstrapPromise: Promise<void> | null = null;

function hasImportLibrary(): boolean {
  return typeof google !== 'undefined' && typeof google.maps?.importLibrary === 'function';
}

/** Waits until `importLibrary` is callable (API fully wired after async bootstrap). */
function waitForImportLibrary(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function step(): void {
      if (hasImportLibrary()) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error('google.maps.importLibrary is not a function'));
        return;
      }
      globalThis.requestAnimationFrame(step);
    }
    step();
  });
}

function loadMapsBootstrap(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser'));
  }
  const key = apiKey.trim();
  if (key.length === 0) {
    return Promise.reject(new Error('Missing Google Maps API key'));
  }
  if (hasImportLibrary()) {
    return Promise.resolve();
  }
  if (bootstrapPromise !== null) {
    return bootstrapPromise;
  }
  bootstrapPromise = new Promise((resolve, reject) => {
    const rejectAndReset = (err: Error): void => {
      bootstrapPromise = null;
      reject(err);
    };

    const settleWhenReady = (): void => {
      void waitForImportLibrary(20_000).then(resolve, rejectAndReset);
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-badgers-google-maps]');
    if (existing !== null) {
      if (hasImportLibrary()) {
        resolve();
        return;
      }
      existing.addEventListener('load', settleWhenReady, { once: true });
      existing.addEventListener(
        'error',
        () => rejectAndReset(new Error('Failed to load Google Maps')),
        { once: true },
      );
      // `load` may have already fired (navigation / HMR); polling covers that case.
      settleWhenReady();
      return;
    }

    const script = document.createElement('script');
    script.dataset.badgersGoogleMaps = 'true';
    script.async = true;

    const cbName = `__badgersGmapsCb${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const globalWin = globalThis as unknown as Record<string, (() => void) | undefined>;
    globalWin[cbName] = (): void => {
      delete globalWin[cbName];
      settleWhenReady();
    };

    script.onerror = () => {
      delete globalWin[cbName];
      rejectAndReset(new Error('Failed to load Google Maps'));
    };

    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${encodeURIComponent(cbName)}&loading=async&v=weekly`;
    document.head.appendChild(script);
  });
  return bootstrapPromise;
}

export type PlacesLibraryWithAutocomplete = google.maps.PlacesLibrary & {
  readonly PlaceAutocompleteElement: new (options?: object) => HTMLElement;
};

/** Ensures bootstrap + Places library are loaded; returns the library object (single `importLibrary` call). */
export async function ensureGoogleMapsPlacesLoaded(apiKey: string): Promise<PlacesLibraryWithAutocomplete> {
  await loadMapsBootstrap(apiKey);
  try {
    const lib = await google.maps.importLibrary('places');
    return lib as PlacesLibraryWithAutocomplete;
  } catch (err) {
    bootstrapPromise = null;
    throw err;
  }
}
