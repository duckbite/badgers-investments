<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import { ensureGoogleMapsPlacesLoaded } from '$lib/maps/load-google-maps-places';
  import { toast } from '$lib/toast/toast';

  /** Browser key (e.g. `import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY`). When empty, renders a plain text input. */
  export let apiKey: string = '';
  export let value: string = '';
  export let placeId: string = '';

  const dispatch = createEventDispatcher<{
    place: {
      readonly formattedAddress: string;
      readonly placeId: string;
      readonly lat: number | null;
      readonly lng: number | null;
    };
  }>();

  type GmpSelectEvent = Event & {
    readonly placePrediction?: { readonly toPlace: () => google.maps.places.Place };
  };

  let hostEl: HTMLDivElement | undefined;
  let widgetEl: HTMLElement | undefined;
  let boundSelectHandler: ((ev: Event) => void) | undefined;

  function readLatLng(
    loc: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
  ): { readonly lat: number; readonly lng: number } | null {
    if (loc === null || loc === undefined) {
      return null;
    }
    if (typeof (loc as google.maps.LatLng).lat === 'function') {
      const l = loc as google.maps.LatLng;
      return { lat: l.lat(), lng: l.lng() };
    }
    const ll = loc as google.maps.LatLngLiteral;
    return { lat: ll.lat, lng: ll.lng };
  }

  function getPlacePrediction(ev: Event): GmpSelectEvent['placePrediction'] | undefined {
    const e = ev as GmpSelectEvent;
    if (e.placePrediction !== undefined) {
      return e.placePrediction;
    }
    if (ev instanceof CustomEvent) {
      const d = ev.detail;
      if (d !== null && typeof d === 'object' && 'placePrediction' in d) {
        return (d as { placePrediction: GmpSelectEvent['placePrediction'] }).placePrediction;
      }
    }
    return undefined;
  }

  async function handleGmpSelect(ev: Event): Promise<void> {
    const prediction = getPlacePrediction(ev);
    if (prediction === undefined) {
      return;
    }
    const place = prediction.toPlace();
    await place.fetchFields({
      fields: ['id', 'formattedAddress', 'location'],
    });
    const addr = place.formattedAddress ?? '';
    if (addr.length === 0) {
      return;
    }
    const id = place.id ?? '';
    value = addr;
    placeId = id;
    const ll = readLatLng(place.location);
    dispatch('place', {
      formattedAddress: addr,
      placeId: id,
      lat: ll?.lat ?? null,
      lng: ll?.lng ?? null,
    });
  }

  onMount(() => {
    const key = apiKey.trim();
    if (key.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await tick();
      if (cancelled || hostEl === undefined) {
        return;
      }
      try {
        const placesLib = await ensureGoogleMapsPlacesLoaded(key);
        if (cancelled || hostEl === undefined) {
          return;
        }
        const el = new placesLib.PlaceAutocompleteElement({});
        /* Host look is mostly from global `gmp-place-autocomplete.badgers-place-input` in `styles/index.css`. */
        el.setAttribute('class', 'badgers-place-input w-full');
        const ph = 'Search for a city or address';
        el.setAttribute('placeholder', ph);
        if ('placeholder' in el) {
          (el as { placeholder: string }).placeholder = ph;
        }
        const initial = value.trim();
        if (initial.length > 0) {
          el.setAttribute('value', initial);
          if ('value' in el) {
            (el as { value: string }).value = initial;
          }
        }
        boundSelectHandler = (ev: Event) => {
          void handleGmpSelect(ev);
        };
        el.addEventListener('gmp-select', boundSelectHandler);
        hostEl.appendChild(el);
        widgetEl = el;
      } catch (e) {
        toast.error('Could not load location search', {
          description: e instanceof Error ? e.message : 'Check Maps key and Places API (New).',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  onDestroy(() => {
    if (widgetEl !== undefined && boundSelectHandler !== undefined) {
      widgetEl.removeEventListener('gmp-select', boundSelectHandler);
      widgetEl.remove();
    }
  });
</script>

{#if apiKey.trim().length === 0}
  <input
    class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-border dark:bg-background"
    placeholder="Location (add PUBLIC_GOOGLE_MAPS_API_KEY for suggestions)"
    bind:value
  />
{:else}
  <div bind:this={hostEl} class="w-full [&:empty]:min-h-[2.625rem]"></div>
{/if}
